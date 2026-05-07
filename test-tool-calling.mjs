/**
 * Tool calling compatibility test for custom API endpoints.
 * Tests whether each endpoint properly supports Anthropic-style tool_use / tool_result.
 *
 * Usage:
 *   node test-tool-calling.mjs
 */

import Anthropic from './apps/api/node_modules/@anthropic-ai/sdk/index.js'

const API_KEY = 'sk-373401f82eb14197b03e7889a2e3e8c7'
const MODEL   = 'cortex-4-6-t'

const ENDPOINTS = [
  'https://app.claude.gg',
  'https://app.claude.gg/v1',
  'https://claude.gg',
]

// A minimal tool — asks the model to call it with a simple calculation
const TEST_TOOL = {
  name: 'calculate',
  description: 'Performs a simple arithmetic calculation.',
  input_schema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The arithmetic expression to evaluate, e.g. "2 + 2"',
      },
    },
    required: ['expression'],
  },
}

const USER_MESSAGE = 'Please use the calculate tool to compute 7 * 6. Do not answer without calling the tool.'

// ── ANSI colors ───────────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m'
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const CYAN   = '\x1b[36m'
const BOLD   = '\x1b[1m'
const RESET  = '\x1b[0m'

function log(color, label, msg) {
  console.log(`${color}${BOLD}[${label}]${RESET} ${msg}`)
}

// ── Test a single endpoint ────────────────────────────────────────────────────
async function testEndpoint(baseURL) {
  log(CYAN, 'TEST', `Endpoint: ${baseURL}`)

  const client = new Anthropic({ apiKey: API_KEY, baseURL })

  const result = {
    endpoint: baseURL,
    step1_tool_called:   false,
    step1_tool_name:     null,
    step1_tool_input:    null,
    step2_final_answer:  null,
    stop_reason_step1:   null,
    stop_reason_step2:   null,
    error:               null,
    latency_ms:          0,
  }

  const t0 = Date.now()

  try {
    // ── Turn 1: model should call the tool ───────────────────────────────────
    const resp1 = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [TEST_TOOL],
      messages: [{ role: 'user', content: USER_MESSAGE }],
    })

    result.stop_reason_step1 = resp1.stop_reason
    log(YELLOW, 'STEP1', `stop_reason=${resp1.stop_reason}  blocks=${resp1.content.map(b => b.type).join(', ')}`)

    const toolUseBlock = resp1.content.find(b => b.type === 'tool_use')

    if (!toolUseBlock) {
      result.error = `Model did NOT call any tool. stop_reason="${resp1.stop_reason}". Content: ${JSON.stringify(resp1.content)}`
      log(RED, 'FAIL', result.error)
      result.latency_ms = Date.now() - t0
      return result
    }

    result.step1_tool_called = true
    result.step1_tool_name   = toolUseBlock.name
    result.step1_tool_input  = toolUseBlock.input
    log(GREEN, 'OK', `Tool called → name="${toolUseBlock.name}" input=${JSON.stringify(toolUseBlock.input)}`)

    // ── Turn 2: send tool result back, model should produce final answer ──────
    const toolResult = {
      type: 'tool_result',
      tool_use_id: toolUseBlock.id,
      content: String(eval(toolUseBlock.input.expression ?? '0')), // safe for arithmetic only
    }

    const resp2 = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      tools: [TEST_TOOL],
      messages: [
        { role: 'user',      content: USER_MESSAGE },
        { role: 'assistant', content: resp1.content },
        { role: 'user',      content: [toolResult] },
      ],
    })

    result.stop_reason_step2 = resp2.stop_reason
    const textBlock = resp2.content.find(b => b.type === 'text')
    result.step2_final_answer = textBlock?.text ?? '(no text block)'
    log(GREEN, 'OK', `Final answer: "${result.step2_final_answer.slice(0, 120)}"`)

  } catch (err) {
    result.error = err?.message ?? String(err)
    log(RED, 'ERROR', result.error)
  }

  result.latency_ms = Date.now() - t0
  return result
}

// ── Run all ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${BOLD}${CYAN}══════════════════════════════════════════════════${RESET}`)
  console.log(`${BOLD}  Tool Calling Compatibility Test — model: ${MODEL}${RESET}`)
  console.log(`${BOLD}${CYAN}══════════════════════════════════════════════════${RESET}\n`)

  const results = []

  for (const ep of ENDPOINTS) {
    console.log(`\n${'─'.repeat(55)}`)
    const r = await testEndpoint(ep)
    results.push(r)
    console.log()
  }

  // ── Summary table ─────────────────────────────────────────────────────────
  console.log(`\n${BOLD}${CYAN}══════════════════════ SUMMARY ═══════════════════════${RESET}`)
  console.log(
    `${'Endpoint'.padEnd(32)} ${'Tool OK'.padEnd(8)} ${'Stop1'.padEnd(12)} ${'Stop2'.padEnd(12)} ${'ms'.padEnd(6)} Error`
  )
  console.log('─'.repeat(100))

  for (const r of results) {
    const toolOK  = r.step1_tool_called ? `${GREEN}YES${RESET}` : `${RED}NO${RESET}`
    const stop1   = (r.stop_reason_step1 ?? 'N/A').padEnd(12)
    const stop2   = (r.stop_reason_step2 ?? 'N/A').padEnd(12)
    const latency = String(r.latency_ms).padEnd(6)
    const ep      = r.endpoint.padEnd(32)
    const err     = r.error ? `${RED}${r.error.slice(0, 60)}${RESET}` : `${GREEN}none${RESET}`
    console.log(`${ep} ${toolOK.padEnd(8)} ${stop1} ${stop2} ${latency} ${err}`)
  }

  console.log()

  // Recommendation
  const working = results.filter(r => r.step1_tool_called && !r.error)
  if (working.length === 0) {
    log(RED, 'RESULT', 'No endpoint supports tool calling with this model/key.')
    log(RED, 'HINT',   'The model may not support tool_use, or the key is invalid.')
  } else {
    log(GREEN, 'RESULT', `Working endpoints: ${working.map(r => r.endpoint).join(' | ')}`)
    const fastest = working.sort((a, b) => a.latency_ms - b.latency_ms)[0]
    log(GREEN, 'RECOMMEND', `Use: ${fastest.endpoint}  (fastest: ${fastest.latency_ms}ms)`)
  }

  console.log()
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})