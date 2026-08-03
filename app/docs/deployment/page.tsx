import { readFileSync } from 'fs'
import { join } from 'path'

export default function DeploymentPage() {
  const content = readFileSync(
    join(process.cwd(), 'DEPLOYMENT.md'),
    'utf-8'
  )

  return (
    <div className="min-h-screen bg-background p-6 sm:p-12">
      <div className="max-w-4xl mx-auto">
        <a href="/" className="text-primary hover:underline mb-6 inline-block">
          ← Back to Home
        </a>
        <div className="prose prose-invert max-w-none">
          <pre className="bg-muted p-6 rounded-lg overflow-auto text-sm whitespace-pre-wrap">
            {content}
          </pre>
        </div>
      </div>
    </div>
  )
}
