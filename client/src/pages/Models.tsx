import React from 'react'
import { api } from '../api'

function parseModelId(id: string) {
  const match = id.match(/^(gpt-\d+(?:\.\d+)?(?:-[a-z]+)?)(?:-(.+))?$/i)
  if (match) {
    return { family: match[1], version: match[2] || "" }
  }
  return { family: id, version: "" }
}

function familyRank(family: string) {
  if (family.startsWith("gpt-5")) return 500
  if (family.startsWith("gpt-4")) return 400
  if (family.startsWith("gpt-3.5")) return 350
  if (family.startsWith("gpt-3")) return 300
  return 0
}

function compareModels(a: string, b: string) {
  const isFtA = a.startsWith("ft:");
  const isFtB = b.startsWith("ft:");
  if (isFtA && !isFtB) return 1;
  if (!isFtA && isFtB) return -1;
  const pa = parseModelId(a)
  const pb = parseModelId(b)
  const ra = familyRank(pa.family)
  const rb = familyRank(pb.family)
  if (ra !== rb) return rb - ra
  if (pa.family !== pb.family) return pa.family.localeCompare(pb.family)
  if (a.length !== b.length) return a.length - b.length
  return a.localeCompare(b)
}

export default function Models() {
  const [providers, setProviders] = React.useState<any[]>([])
  React.useEffect(() => { api('/providers').then(setProviders) }, [])
  return (
    <div>
      <h2>Models</h2>
      <p>Models are pulled from providers and kept in memory. This list refreshes on startup and when providers are edited.</p>
      <table>
        <thead><tr><th>Provider</th><th>Model</th></tr></thead>
        <tbody>
          {(() => {
            const rows: JSX.Element[] = []
            providers.forEach((p:any) => {
              let pulled: string[] = p.runtime_models || []
              if (p.enabled && pulled.length) {
                pulled = [...pulled].sort(compareModels)
                pulled.forEach((name:string) => rows.push(<tr key={`${p.id}:${name}`}><td>{p.name}</td><td>{name}</td></tr>))
              }
            })
            return rows.length ? rows : [<tr key="none"><td colSpan={2}>No pulled models.</td></tr>]
          })()}
        </tbody>
      </table>
    </div>
  )
}
