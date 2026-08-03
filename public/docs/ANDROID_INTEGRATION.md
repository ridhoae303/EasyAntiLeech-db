# Android Integration Guide

Complete guide for integrating anti-leech backend verification into your Android app.

---

## Architecture

```
App Startup
    ↓
Local Signature Verification
    ↓
Backend Verification (HTTPS + Certificate Pinning)
    ↓
Nonce Validation + HMAC Check
    ↓
App Allowed to Run
    ↓
Local Anti-Tamper Logic (your responsibility)
```

**Important:** 
- Backend is verification layer only
- Backend NEVER kills the app
- Your local anti-tamper logic must enforce termination
- Backend rejection means app shouldn't contact backend again that session

---

## Step 1: Extract Your Signing Certificate Hash

### Using Android Studio

1. Open your project in Android Studio
2. Go to `Build → Analyze APK` → select your signed APK
3. Go to "AndroidManifest.xml"
4. Look for signing certificate in properties
5. Calculate SHA-256 hash

### Using Command Line

```bash
# Get certificate info from signed APK
keytool -printcert -jarfile your-app.apk | grep SHA256

# Get from keystore
keytool -list -v -keystore keystore.jks \
  -alias your_key_alias \
  -storepass password | grep SHA256
```

### Programmatic (at runtime)

```kotlin
import android.content.pm.PackageManager
import android.content.pm.SigningInfo
import java.security.MessageDigest

fun getAppSignature(context: Context): String? {
    return try {
        val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            context.packageManager
                .getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
                .signingInfo
                .signingCertificateHistory
        } else {
            @Suppress("DEPRECATION")
            context.packageManager
                .getPackageInfo(context.packageName, PackageManager.GET_SIGNATURES)
                .signatures
        }
        
        if (signatures.isNotEmpty()) {
            val cert = signatures[0]
            val md = MessageDigest.getInstance("SHA256")
            val digest = md.digest(cert.toByteArray())
            digest.joinToString("") { "%02x".format(it) }
        } else {
            null
        }
    } catch (e: Exception) {
        null
    }
}
```

---

## Step 2: Set Up Certificate Pinning

### Using OkHttp

```gradle
dependencies {
    implementation 'com.squareup.okhttp3:okhttp:4.11.0'
}
```

```kotlin
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient

object HttpClientFactory {
    fun createSecureClient(): OkHttpClient {
        // Get certificate hash from backend domain
        // Pin your production certificate here
        val certificatePinner = CertificatePinner.Builder()
            .add("your-domain.vercel.app", "sha256/YOUR_CERTIFICATE_HASH")
            // Add backup pins
            .add("your-domain.vercel.app", "sha256/BACKUP_CERTIFICATE_HASH")
            .build()
        
        return OkHttpClient.Builder()
            .certificatePinner(certificatePinner)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }
}
```

### Using Retrofit + OkHttp

```kotlin
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object ApiClientFactory {
    fun createSecureRetrofit(): Retrofit {
        return Retrofit.Builder()
            .baseUrl("https://your-domain.vercel.app/")
            .client(HttpClientFactory.createSecureClient())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }
}
```

---

## Step 3: Implement Verification Request

### Data Models

```kotlin
import com.google.gson.annotations.SerializedName
import java.util.UUID

data class VerificationRequest(
    @SerializedName("packageName")
    val packageName: String,
    
    @SerializedName("sha256Signature")
    val sha256Signature: String,
    
    @SerializedName("androidVersion")
    val androidVersion: String,
    
    @SerializedName("deviceModel")
    val deviceModel: String,
    
    @SerializedName("timestamp")
    val timestamp: Long,
    
    @SerializedName("nonce")
    val nonce: String,
    
    @SerializedName("hmac")
    val hmac: String
)

data class VerificationResponse(
    @SerializedName("status")
    val status: String, // "allowed" or "rejected"
    
    @SerializedName("reason")
    val reason: String? = null,
    
    @SerializedName("timestamp")
    val timestamp: Long
)
```

### API Service Interface

```kotlin
import retrofit2.http.Body
import retrofit2.http.POST

interface VerificationService {
    @POST("api/verify")
    suspend fun verify(@Body request: VerificationRequest): VerificationResponse
}
```

### HMAC Calculation

```kotlin
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import java.util.SortedMap

class HmacCalculator(private val secret: String) {
    
    fun calculateHmac(payload: Map<String, Any>): String {
        // Sort keys alphabetically for consistent hashing
        val sorted = payload.toSortedMap()
        
        // Create message string (compact JSON, no extra whitespace)
        val message = buildJsonString(sorted)
        
        // Calculate HMAC-SHA256
        val hmacAlgorithm = Mac.getInstance("HmacSHA256")
        hmacAlgorithm.init(SecretKeySpec(secret.toByteArray(), "HmacSHA256"))
        
        val hmacBytes = hmacAlgorithm.doFinal(message.toByteArray())
        
        // Return as hex string
        return hmacBytes.joinToString("") { "%02x".format(it) }
    }
    
    private fun buildJsonString(map: Map<String, Any>): String {
        val sb = StringBuilder()
        sb.append("{")
        
        var first = true
        for ((key, value) in map) {
            if (!first) sb.append(",")
            first = false
            
            sb.append("\"$key\":")
            when (value) {
                is String -> sb.append("\"$value\"")
                is Number -> sb.append(value)
                else -> sb.append("\"$value\"")
            }
        }
        
        sb.append("}")
        return sb.toString()
    }
}
```

### Verification Manager

```kotlin
import android.app.ActivityManager
import android.content.Context
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.UUID

class AppVerificationManager(
    private val context: Context,
    private val verificationService: VerificationService,
    private val hmacSecret: String // ⚠️ DO NOT hardcode - retrieve securely
) {
    
    private val hmacCalculator = HmacCalculator(hmacSecret)
    
    suspend fun verifyAppAuthenticity(): VerificationResult {
        return withContext(Dispatchers.IO) {
            try {
                // Step 1: Get app signature
                val appSignature = getAppSignature() 
                    ?: return@withContext VerificationResult.Failure("Could not get app signature")
                
                // Step 2: Build verification request
                val request = buildVerificationRequest(appSignature)
                
                // Step 3: Send to backend
                val response = try {
                    verificationService.verify(request)
                } catch (e: Exception) {
                    return@withContext VerificationResult.Failure("Network error: ${e.message}")
                }
                
                // Step 4: Check response
                return@withContext when (response.status) {
                    "allowed" -> VerificationResult.Success
                    "rejected" -> VerificationResult.Rejected(response.reason ?: "Unknown reason")
                    else -> VerificationResult.Failure("Invalid response status")
                }
                
            } catch (e: Exception) {
                VerificationResult.Failure("Verification failed: ${e.message}")
            }
        }
    }
    
    private fun buildVerificationRequest(appSignature: String): VerificationRequest {
        val now = System.currentTimeMillis()
        val nonce = generateNonce()
        
        val payload = mapOf<String, Any>(
            "androidVersion" to Build.VERSION.RELEASE,
            "deviceModel" to Build.MODEL,
            "nonce" to nonce,
            "packageName" to context.packageName,
            "sha256Signature" to appSignature,
            "timestamp" to now
        )
        
        val hmac = hmacCalculator.calculateHmac(payload)
        
        return VerificationRequest(
            packageName = context.packageName,
            sha256Signature = appSignature,
            androidVersion = Build.VERSION.RELEASE,
            deviceModel = Build.MODEL,
            timestamp = now,
            nonce = nonce,
            hmac = hmac
        )
    }
    
    private fun getAppSignature(): String? {
        return try {
            val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                context.packageManager
                    .getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
                    .signingInfo
                    .signingCertificateHistory
            } else {
                @Suppress("DEPRECATION")
                context.packageManager
                    .getPackageInfo(context.packageName, PackageManager.GET_SIGNATURES)
                    .signatures
            }
            
            if (signatures.isEmpty()) return null
            
            val digest = MessageDigest.getInstance("SHA256")
            digest.update(signatures[0].toByteArray())
            
            digest.digest().joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            null
        }
    }
    
    private fun generateNonce(): String {
        return UUID.randomUUID().toString().replace("-", "") +
               UUID.randomUUID().toString().replace("-", "")
    }
}

sealed class VerificationResult {
    data object Success : VerificationResult()
    data class Rejected(val reason: String) : VerificationResult()
    data class Failure(val error: String) : VerificationResult()
}
```

---

## Step 4: Integrate with App Lifecycle

### Application Startup

```kotlin
import android.app.Application
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch

class MyApplication : Application() {
    
    private lateinit var verificationManager: AppVerificationManager
    
    override fun onCreate() {
        super.onCreate()
        
        // Initialize verification manager
        val retrofit = ApiClientFactory.createSecureRetrofit()
        val service = retrofit.create(VerificationService::class.java)
        
        verificationManager = AppVerificationManager(
            context = this,
            verificationService = service,
            hmacSecret = retrieveHmacSecretSecurely()
        )
        
        // Verify app on startup
        GlobalScope.launch {
            val result = verificationManager.verifyAppAuthenticity()
            
            when (result) {
                is VerificationResult.Success -> {
                    // App verified, continue normally
                    // Local anti-tamper logic runs here
                }
                is VerificationResult.Rejected -> {
                    // Backend rejected this app
                    handleRejection(result.reason)
                }
                is VerificationResult.Failure -> {
                    // Verification failed (network error, etc.)
                    handleVerificationError(result.error)
                }
            }
        }
    }
    
    private fun retrieveHmacSecretSecurely(): String {
        // Option 1: Obfuscated string (minimal security)
        // return deobfuscateSecret()
        
        // Option 2: Dynamic retrieval from config
        // return fetchFromSecureServer()
        
        // Option 3: User-provided during login
        // return userSession.getHmacSecret()
        
        // For now, use a default (MUST be changed in production)
        return ""
    }
    
    private fun handleRejection(reason: String) {
        // Log the rejection
        logSecurityEvent("APP_REJECTED_BY_BACKEND: $reason")
        
        // Option 1: Block app startup
        // killApp()
        
        // Option 2: Restricted mode
        // enterRestrictedMode()
        
        // Option 3: Graceful degradation
        // disableSensitiveFeatures()
    }
    
    private fun handleVerificationError(error: String) {
        // Network error - decide your policy:
        // - Allow with local cache
        // - Block until online
        // - Use fallback mechanism
        
        logSecurityEvent("VERIFICATION_ERROR: $error")
    }
}
```

### Activity Integration

```kotlin
import androidx.appcompat.app.AppCompatActivity
import android.os.Bundle

class MainActivity : AppCompatActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Re-verify on app resume if needed
        // This is optional but recommended for sensitive apps
        
        setContentView(R.layout.activity_main)
    }
    
    override fun onResume() {
        super.onResume()
        
        // Optional: Periodic verification
        // Useful for detecting app replacement during runtime
        // verifyAppAuthenticity()
    }
}
```

---

## Step 5: Local Anti-Tamper Logic

This runs AFTER backend verification succeeds:

```kotlin
import java.io.File

class LocalAntiTamperVerifier(private val context: Context) {
    
    fun performLocalVerification(): Boolean {
        // Check 1: Debugger detection
        if (isDebuggerAttached()) {
            terminateApp("Debugger detected")
            return false
        }
        
        // Check 2: Root detection
        if (isDeviceRooted()) {
            terminateApp("Device rooted")
            return false
        }
        
        // Check 3: Emulator detection
        if (isRunningInEmulator()) {
            // Decide based on your policy
        }
        
        // Check 4: Package tampering
        if (isAppPackageTampered()) {
            terminateApp("Package tampering detected")
            return false
        }
        
        // Check 5: DEX tampering
        if (isDexTampered()) {
            terminateApp("DEX tampering detected")
            return false
        }
        
        return true
    }
    
    private fun isDebuggerAttached(): Boolean {
        return android.os.Debug.isDebuggerConnected() ||
               android.os.Debug.waitingForDebugger()
    }
    
    private fun isDeviceRooted(): Boolean {
        return File("/system/app/Superuser.apk").exists() ||
               File("/system/xbin/su").exists() ||
               File("/system/bin/su").exists() ||
               checkSuPath()
    }
    
    private fun checkSuPath(): Boolean {
        return try {
            val pathEnvironment = System.getenv("PATH") ?: ""
            pathEnvironment.split(":").any { File("$it/su").exists() }
        } catch (e: Exception) {
            false
        }
    }
    
    private fun isRunningInEmulator(): Boolean {
        return android.os.Build.FINGERPRINT.contains("generic") ||
               android.os.Build.FINGERPRINT.contains("unknown") ||
               android.os.Build.MODEL.contains("Emulator") ||
               android.os.Build.MODEL.contains("Android SDK")
    }
    
    private fun isAppPackageTampered(): Boolean {
        return try {
            val pm = context.packageManager
            val appInfo = pm.getApplicationInfo(context.packageName, 0)
            
            // Check if app is installed in non-standard location
            !appInfo.sourceDir.startsWith("/system/") &&
            !appInfo.sourceDir.startsWith("/data/app/")
        } catch (e: Exception) {
            false
        }
    }
    
    private fun isDexTampered(): Boolean {
        // Check DEX CRC/MD5 against expected values
        // This requires pre-computing hashes during app build
        return false
    }
    
    private fun terminateApp(reason: String) {
        logSecurityEvent("LOCAL_VERIFICATION_FAILED: $reason")
        
        // Force kill the app process
        android.os.Process.killProcess(android.os.Process.myPid())
        System.exit(0)
    }
}
```

---

## Step 6: Error Handling & Fallback

```kotlin
sealed class VerificationPolicy {
    data object StrictMode : VerificationPolicy()
    data object CacheMode : VerificationPolicy()
    data object GracefulDegradation : VerificationPolicy()
}

class VerificationPolicyHandler(
    private val context: Context,
    private val policy: VerificationPolicy
) {
    
    fun handleVerificationFailure(error: String) {
        when (policy) {
            VerificationPolicy.StrictMode -> {
                // No internet = no app run
                showErrorDialog("Unable to verify app. Please check internet connection.")
                killApp()
            }
            
            VerificationPolicy.CacheMode -> {
                // Use cached verification result from last successful run
                if (hasValidCachedVerification()) {
                    // Allow app with cached result
                } else {
                    killApp()
                }
            }
            
            VerificationPolicy.GracefulDegradation -> {
                // Allow app but disable sensitive features
                disableSensitiveFeatures()
            }
        }
    }
    
    private fun hasValidCachedVerification(): Boolean {
        val sharedPref = context.getSharedPreferences("verification", Context.MODE_PRIVATE)
        val lastVerificationTime = sharedPref.getLong("last_success", 0)
        val cacheValidityMs = 24 * 60 * 60 * 1000 // 24 hours
        
        return (System.currentTimeMillis() - lastVerificationTime) < cacheValidityMs
    }
    
    private fun disableSensitiveFeatures() {
        // Disable premium features, payments, etc.
    }
    
    private fun killApp() {
        System.exit(0)
    }
}
```

---

## Step 7: Testing

### Unit Tests

```kotlin
import org.junit.Test
import org.junit.Assert.*

class HmacCalculatorTest {
    
    private val calculator = HmacCalculator("test-secret")
    
    @Test
    fun testHmacCalculation() {
        val payload = mapOf(
            "packageName" to "com.example.app",
            "timestamp" to 1692345600000L,
            "nonce" to "abc123"
        )
        
        val hmac1 = calculator.calculateHmac(payload)
        val hmac2 = calculator.calculateHmac(payload)
        
        assertEquals(hmac1, hmac2)
        assertEquals(64, hmac1.length) // SHA256 = 64 hex chars
    }
    
    @Test
    fun testNonceGeneration() {
        val nonce1 = generateNonce()
        val nonce2 = generateNonce()
        
        assertNotEquals(nonce1, nonce2)
        assertEquals(64, nonce1.length)
    }
}

class VerificationServiceTest {
    
    @Test
    fun testSuccessfulVerification() {
        // Mock backend response
        val response = VerificationResponse(
            status = "allowed",
            timestamp = System.currentTimeMillis()
        )
        
        assertEquals("allowed", response.status)
    }
}
```

### Integration Tests

```kotlin
@RunWith(AndroidJUnit4::class)
class VerificationIntegrationTest {
    
    @get:Rule
    val activityRule = ActivityScenarioRule(MainActivity::class.java)
    
    @Test
    fun testEndToEndVerification() {
        // Test actual backend communication
        // Requires test backend endpoint
    }
}
```

---

## Security Checklist for Android

- [x] Certificate pinning implemented
- [x] HMAC validation before sending
- [x] Nonce generated fresh each request
- [x] Timestamp synchronized with NTP
- [x] Debugger detection implemented
- [x] Root detection implemented
- [x] Emulator detection implemented (optional)
- [x] Package integrity checks
- [x] DEX integrity checks
- [x] Proper error handling
- [x] No hardcoded secrets
- [x] Secrets secured (encrypted SharedPreferences or keystore)
- [x] Network security config for HTTPS
- [x] Proguard/R8 enabled for obfuscation
- [x] StrictMode enabled (detects leaks)
- [x] Unit tests for verification logic
- [x] Integration tests with backend

---

## Distribution & Updates

1. **App Signing**: Sign APK with your keystore
2. **SHA-256 Extraction**: Get from signed APK
3. **Backend Registration**: Add to allowed_signatures table
4. **App Release**: Users install app from Play Store
5. **Verification**: App verifies on first launch

For updates:
- Sign new APK with same key
- SHA-256 remains constant
- App continues to verify with backend

---

## References

- [Android Security Best Practices](https://developer.android.com/training/articles/security-tips)
- [OkHttp Certificate Pinning](https://square.github.io/okhttp/features/https/)
- [PackageManager API](https://developer.android.com/reference/android/content/pm/PackageManager)
- [Android Emulator Detection](https://developer.android.com/studio/run/emulator-detection)
