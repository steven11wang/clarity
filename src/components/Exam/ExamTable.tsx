import type { ExamTable as Table } from './examData.ts'

/** A data table stimulus, rendered above the passage like the real app does. */
export function ExamTable({ table }: { table: Table }) {
  return (
    <figure className="exam-table">
      {table.caption ? <figcaption>{table.caption}</figcaption> : null}
      <div className="exam-table__scroll">
        <table>
          <thead>
            <tr>
              {table.headers.map((header, index) => (
                <th key={index} scope="col">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) =>
                  cellIndex === 0 ? (
                    <th key={cellIndex} scope="row">{cell}</th>
                  ) : (
                    <td key={cellIndex}>{cell}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
