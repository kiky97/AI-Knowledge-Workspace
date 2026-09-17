import { forceCenter, forceLink, forceManyBody, forceSimulation } from 'd3-force'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { api } from '../lib/api'

interface GraphNode {
  id: string
  label: string
  x?: number
  y?: number
}

interface GraphEdge {
  source: string
  target: string
}

const WIDTH = 800
const HEIGHT = 560

export function NotesGraph() {
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/api/notes/graph').then(({ data }) => {
      const simNodes: GraphNode[] = data.nodes.map((n: GraphNode) => ({ ...n }))
      const simEdges = data.edges.map((e: GraphEdge) => ({ ...e }))

      const simulation = forceSimulation(simNodes as any)
        .force('charge', forceManyBody().strength(-220))
        .force(
          'link',
          forceLink(simEdges as any)
            .id((d: any) => d.id)
            .distance(110),
        )
        .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
        .stop()

      for (let i = 0; i < 300; i++) simulation.tick()

      setNodes(simNodes)
      setEdges(simEdges)
    })
  }, [])

  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  return (
    <Layout>
      <div className="page-header">
        <h1>Knowledge Graph</h1>
        <Link to="/notes">← Back to notes</Link>
      </div>

      {nodes.length === 0 ? (
        <p className="empty-state">
          No notes to graph yet. Add notes and link them with <code>[[Note Title]]</code>.
        </p>
      ) : (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="graph-svg">
          {edges.map((edge, i) => {
            const source = nodeById.get(typeof edge.source === 'string' ? edge.source : (edge.source as any).id)
            const target = nodeById.get(typeof edge.target === 'string' ? edge.target : (edge.target as any).id)
            if (!source || !target) return null
            return (
              <line
                key={i}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className="graph-edge"
              />
            )
          })}
          {nodes.map((node) => (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              className="graph-node"
              onClick={() => navigate('/notes')}
            >
              <circle r={22} />
              <text textAnchor="middle" dy={5}>
                {node.label.length > 14 ? `${node.label.slice(0, 14)}…` : node.label}
              </text>
            </g>
          ))}
        </svg>
      )}
    </Layout>
  )
}
