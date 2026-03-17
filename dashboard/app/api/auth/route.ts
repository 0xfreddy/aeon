import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

function ghAvailable(): boolean {
  try {
    execSync('gh auth status', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

export async function GET() {
  // Check if ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN is set
  try {
    if (!ghAvailable()) {
      return NextResponse.json({ authenticated: false, error: 'gh CLI not authenticated' })
    }
    const out = execSync('gh secret list --json name -q ".[].name"', {
      stdio: 'pipe',
    }).toString().trim()
    const secrets = out ? out.split('\n').filter(Boolean) : []
    const hasApiKey = secrets.includes('ANTHROPIC_API_KEY')
    const hasOauth = secrets.includes('CLAUDE_CODE_OAUTH_TOKEN')
    return NextResponse.json({ authenticated: hasApiKey || hasOauth, hasApiKey, hasOauth })
  } catch {
    return NextResponse.json({ authenticated: false })
  }
}

export async function POST(request: Request) {
  // Accept a manually provided API key or OAuth token
  try {
    if (!ghAvailable()) {
      return NextResponse.json({ error: 'gh CLI not authenticated. Run: gh auth login' }, { status: 503 })
    }

    const body = await request.json().catch(() => ({})) as { key?: string }

    if (body.key) {
      // User pasted an API key — save as ANTHROPIC_API_KEY
      execSync('gh secret set ANTHROPIC_API_KEY', {
        input: body.key.trim(),
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      return NextResponse.json({ ok: true, method: 'api-key' })
    }

    // No key provided — try claude setup-token and extract the sk-ant-oat token
    const output = execSync('claude setup-token', {
      stdio: 'pipe',
      timeout: 60000,
    }).toString()

    // The token starts with sk-ant-oat and may wrap across multiple lines
    const match = output.match(/sk-ant-oat[A-Za-z0-9_\-]+/g)
    if (!match) {
      return NextResponse.json({
        error: 'Could not extract token. Paste your API key manually instead.',
      }, { status: 400 })
    }
    // Join in case the token wrapped across lines (strip whitespace between fragments)
    const token = match.join('')

    execSync('gh secret set CLAUDE_CODE_OAUTH_TOKEN', {
      input: token,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    return NextResponse.json({ ok: true, method: 'oauth' })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to setup auth'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
