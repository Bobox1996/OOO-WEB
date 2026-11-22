'use client'

import { useState } from 'react'
import experiment from './experiment.json'
import styles from './study.module.css'

export default function GridStudy() {
  const [columns, setColumns] = useState(6)
  const [rows, setRows] = useState(4)
  const [bay, setBay] = useState(5)
  const width = columns * bay
  const depth = rows * bay
  const scale = Math.min(496 / width, 270 / depth)
  const step = bay * scale
  const left = (600 - width * scale) / 2
  const top = (370 - depth * scale) / 2
  const axesX = Array.from({ length: columns + 1 }, (_, i) => left + i * step)
  const axesY = Array.from({ length: rows + 1 }, (_, i) => top + i * step)

  return (
    <section className={styles.study}>
      <h1>{experiment.title}</h1>
      <p className={styles.description}>{experiment.description}</p>
      <div className={styles.workspace}>
        <div className={styles.controls}>
          {[
            { label: 'Columns', value: columns, update: setColumns, max: 12, unit: '' },
            { label: 'Rows', value: rows, update: setRows, max: 10, unit: '' },
            { label: 'Bay spacing', value: bay, update: setBay, max: 9, unit: ' m' },
          ].map(control => (
            <label key={control.label}>
              <span>{control.label}<output>{control.value}{control.unit}</output></span>
              <input type="range" min={1} max={control.max} value={control.value}
                aria-label={control.label} aria-valuetext={`${control.value}${control.unit}`}
                onChange={event => control.update(Number(event.target.value))} />
            </label>
          ))}
          <div className={styles.area}><span>Floor plate</span><strong>{width * depth} m²</strong></div>
        </div>
        <figure className={styles.drawing}>
          <svg viewBox="0 0 600 370" role="img" aria-label={`Structural grid, ${width} by ${depth} metres`}>
            <g stroke="#a7a7a2" strokeWidth="1">
              {axesX.map(x => <line key={x} x1={x} x2={x} y1={top - 6} y2={370 - top + 6} />)}
              {axesY.map(y => <line key={y} y1={y} y2={y} x1={left - 6} x2={600 - left + 6} />)}
            </g>
            <g fill="#252522">
              {axesX.map(x => axesY.map(y => <rect key={`${x},${y}`} x={x - 2.5} y={y - 2.5} width="5" height="5" />))}
            </g>
            <g fontFamily="Arial, sans-serif" fontSize="14" fill="#4a4a47" textAnchor="middle">
              <text x="300" y={370 - top + 28}>{width} m</text>
              <text x={left - 24} y="185" transform={`rotate(-90 ${left - 24} 185)`}>{depth} m</text>
            </g>
          </svg>
        </figure>
      </div>
    </section>
  )
}
