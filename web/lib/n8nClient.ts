export async function callCitizenAgent(payload: any) {
  const url = process.env.N8N_CITIZEN_WEBHOOK
  if (!url) {
    console.warn('N8N_CITIZEN_WEBHOOK not configured')
    return
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    console.error('Failed to call Citizen Agent', await res.text())
  }
}
