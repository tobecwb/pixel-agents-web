import { useState } from 'react'
import type { ToolActivity } from '../office/types.js'
import { vscode } from '../vscodeApi.js'

interface DebugViewProps {
  agents: number[]
  selectedAgent: number | null
  agentTools: Record<number, ToolActivity[]>
  agentStatuses: Record<number, string>
  subagentTools: Record<number, Record<string, ToolActivity[]>>
  onSelectAgent: (id: number) => void
  onClose: () => void
}

/** Z-index just below the floating toolbar (50) so the toolbar stays on top */
const DEBUG_Z = 40

function ToolDot({ tool }: { tool: ToolActivity }) {
  return (
    <span
      className={tool.done ? undefined : 'pixel-agents-pulse'}
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: tool.done
          ? '#89d185'
          : tool.permissionWait
            ? '#cca700'
            : '#3794ff',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  )
}

function ToolLine({ tool }: { tool: ToolActivity }) {
  return (
    <span
      style={{
        fontSize: '22px',
        opacity: tool.done ? 0.5 : 0.8,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <ToolDot tool={tool} />
      {tool.permissionWait && !tool.done ? 'Needs approval' : tool.status}
    </span>
  )
}

export function DebugView({
  agents,
  selectedAgent,
  agentTools,
  agentStatuses,
  subagentTools,
  onSelectAgent,
  onClose,
}: DebugViewProps) {
  const [confirmCloseId, setConfirmCloseId] = useState<number | null>(null)

  const renderAgentCard = (id: number) => {
    const isSelected = selectedAgent === id
    const tools = agentTools[id] || []
    const subs = subagentTools[id] || {}
    const status = agentStatuses[id]
    const hasActiveTools = tools.some((t) => !t.done)
    const isConfirming = confirmCloseId === id
    return (
      <div
        key={id}
        style={{
          border: `2px solid ${isSelected ? '#5a8cff' : '#4a4a6a'}`,
          borderRadius: 0,
          padding: '6px 8px',
          background: isSelected ? 'rgba(255,255,255,0.08)' : undefined,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
          <button
            onClick={() => onSelectAgent(id)}
            style={{
              borderRadius: 0,
              padding: '6px 10px',
              fontSize: '26px',
              background: isSelected ? 'rgba(90, 140, 255, 0.25)' : undefined,
              color: isSelected ? '#fff' : undefined,
              fontWeight: isSelected ? 'bold' : undefined,
            }}
          >
            Agent #{id}
          </button>
          {isConfirming ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
              <span style={{ fontSize: '22px', color: '#cca700' }}>Remove?</span>
              <button
                onClick={() => { setConfirmCloseId(null); vscode.postMessage({ type: 'closeAgent', id }) }}
                style={{
                  borderRadius: 0,
                  padding: '4px 8px',
                  fontSize: '22px',
                  background: 'rgba(204, 50, 50, 0.4)',
                  color: '#fff',
                }}
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmCloseId(null)}
                style={{
                  borderRadius: 0,
                  padding: '4px 8px',
                  fontSize: '22px',
                }}
              >
                No
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmCloseId(id)}
              style={{
                borderRadius: 0,
                padding: '6px 8px',
                fontSize: '22px',
                opacity: 0.4,
              }}
              title="Remove agent"
            >
              ✕
            </button>
          )}
        </span>
        {(tools.length > 0 || status === 'waiting') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 4, paddingLeft: 4 }}>
            {tools.map((tool) => (
              <div key={tool.toolId}>
                <ToolLine tool={tool} />
                {subs[tool.toolId] && subs[tool.toolId].length > 0 && (
                  <div
                    style={{
                      borderLeft: '2px solid rgba(255,255,255,0.12)',
                      marginLeft: 3,
                      paddingLeft: 8,
                      marginTop: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    {subs[tool.toolId].map((subTool) => (
                      <ToolLine key={subTool.toolId} tool={subTool} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {status === 'waiting' && !hasActiveTools && (
              <span
                style={{
                  fontSize: '22px',
                  opacity: 0.85,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#cca700',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                Might be waiting for input
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(30, 30, 46, 0.75)',
        zIndex: DEBUG_Z,
        overflow: 'auto',
      }}
    >
      <div style={{ padding: '12px 12px 12px', fontSize: '28px', color: '#e0e0e0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '26px', opacity: 0.7 }}>Debug View</span>
          <button
            onClick={onClose}
            style={{
              borderRadius: 0,
              padding: '4px 12px',
              fontSize: '24px',
              background: 'var(--pixel-btn-bg)',
              color: 'var(--pixel-text-dim)',
              border: '2px solid var(--pixel-border)',
            }}
          >
            Close
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {agents.map(renderAgentCard)}
        </div>
      </div>
    </div>
  )
}
