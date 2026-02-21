"use client"

import { useState } from "react"

export default function CitizenForm() {
  const [form, setForm] = useState({
    email: "",
    age: "",
    income: "",
    state: "",
    category: ""
  })

  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const res = await fetch("/api/citizen", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...form,
        age: Number(form.age),
        income: Number(form.income)
      })
    })

    let data: any = null
    try {
      const contentType = res.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        data = await res.json()
      } else {
        // non-JSON (HTML error page or plain text)
        const text = await res.text()
        alert(`Server error (${res.status}): ${text.slice(0, 200)}`)
        setLoading(false)
        return
      }
    } catch (err) {
      alert("Failed to parse server response")
      setLoading(false)
      return
    }

    setLoading(false)

    if (data?.error) {
      alert(data.error)
      return
    }

    alert("Submitted! Eligibility is being processed.")
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 max-w-md bg-white p-6 rounded shadow"
    >
      <input
        className="border p-2 w-full"
        placeholder="Email"
        required
        onChange={e => setForm({ ...form, email: e.target.value })}
      />

      <input
        className="border p-2 w-full"
        placeholder="Age"
        type="number"
        required
        onChange={e => setForm({ ...form, age: e.target.value })}
      />

      <input
        className="border p-2 w-full"
        placeholder="Income"
        type="number"
        required
        onChange={e => setForm({ ...form, income: e.target.value })}
      />

      <input
        className="border p-2 w-full"
        placeholder="State"
        onChange={e => setForm({ ...form, state: e.target.value })}
      />

      <input
        className="border p-2 w-full"
        placeholder="Category (student, farmer, etc.)"
        onChange={e => setForm({ ...form, category: e.target.value })}
      />

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded w-full"
      >
        {loading ? "Processing..." : "Check Eligibility"}
      </button>
    </form>
  )
}