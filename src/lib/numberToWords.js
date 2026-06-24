const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n) {
  if (n === 0) return ''
  if (n < 20) return ONES[n]
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')
}

function threeDigits(n) {
  if (n === 0) return ''
  if (n < 100) return twoDigits(n)
  return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '')
}

export function numberToWords(amount) {
  const n = Math.round(Math.abs(amount))
  if (n === 0) return 'Zero Rupees Only'

  let num = n
  const parts = []

  if (num >= 10000000) {
    parts.push(threeDigits(Math.floor(num / 10000000)) + ' Crore')
    num %= 10000000
  }
  if (num >= 100000) {
    parts.push(twoDigits(Math.floor(num / 100000)) + ' Lakh')
    num %= 100000
  }
  if (num >= 1000) {
    parts.push(twoDigits(Math.floor(num / 1000)) + ' Thousand')
    num %= 1000
  }
  if (num > 0) {
    parts.push(threeDigits(num))
  }

  return parts.filter(Boolean).join(' ') + ' Rupees Only'
}
