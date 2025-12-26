export default function TestPage() {
  return (
    <html>
      <body style={{ backgroundColor: 'red', color: 'white', padding: '20px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold' }}>TEST PAGE</h1>
        <p>If you see this with RED background, browser is working!</p>
        <p style={{ marginTop: '20px', fontSize: '18px' }}>
          Background: <strong>RED</strong>
          <br />
          Text: <strong>WHITE</strong>
        </p>
        <div
          style={{
            marginTop: '20px',
            padding: '20px',
            backgroundColor: 'blue',
            color: 'white',
            borderRadius: '8px',
          }}
        >
          <p>Blue box test</p>
        </div>
      </body>
    </html>
  )
}
