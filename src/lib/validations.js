// Shared react-hook-form rules for phone number fields
export const PHONE_RULES = {
  required: 'Phone number is required',
  pattern: {
    value: /^\d{10}$/,
    message: 'Must be exactly 10 digits',
  },
}

// For optional phone fields (WhatsApp, supplier phone) — validates only if a value is entered
export const PHONE_RULES_OPTIONAL = {
  pattern: {
    value: /^(\d{10})?$/,
    message: 'Must be exactly 10 digits',
  },
}

// onKeyDown handler — blocks any non-digit key on desktop
export function phoneKeyDown(e) {
  const allowed = [
    'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Home', 'End',
  ]
  if (allowed.includes(e.key)) return
  if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return
  if (!/^\d$/.test(e.key)) e.preventDefault()
}

// onPaste handler — strips non-digits from pasted text
export function phonePaste(e) {
  const pasted = e.clipboardData.getData('text')
  const digits = pasted.replace(/\D/g, '').slice(0, 10)
  if (pasted !== digits) {
    e.preventDefault()
    const input = e.target
    const start = input.selectionStart
    const end = input.selectionEnd
    const current = input.value
    input.value = (current.slice(0, start) + digits + current.slice(end)).slice(0, 10)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

// Spread these props onto any phone <Input> alongside {...register(...)}
export const phoneInputProps = {
  type: 'tel',
  inputMode: 'numeric',
  maxLength: 10,
  onKeyDown: phoneKeyDown,
  onPaste: phonePaste,
}
