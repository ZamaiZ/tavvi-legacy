const mediumDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })
export function formatDate(value: string | number | Date) { return mediumDate.format(new Date(value)) }
