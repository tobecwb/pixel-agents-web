let ws: WebSocket | null = null
let pending: unknown[] = []

let hasConnectedBefore = false

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${proto}//${location.host}/ws`)
  ws.onopen = () => {
    pending.forEach((m) => ws!.send(JSON.stringify(m)))
    pending = []
    // On reconnect, re-request full state from server
    if (hasConnectedBefore) {
      ws!.send(JSON.stringify({ type: 'webviewReady' }))
    }
    hasConnectedBefore = true
  }
  ws.onmessage = (e) => {
    const data = JSON.parse(e.data as string)
    window.dispatchEvent(new MessageEvent('message', { data }))
  }
  ws.onclose = () => {
    ws = null
    setTimeout(connect, 2000)
  }
}
connect()

export const vscode = {
  postMessage(msg: unknown) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    } else {
      pending.push(msg)
    }
  },
}
