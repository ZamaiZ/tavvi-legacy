'use client'

import { useState, type FormEvent } from 'react'
import { LuCalendarDays, LuChevronLeft, LuChevronRight } from 'react-icons/lu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { fromRestaurantDateTimeInput, toRestaurantDateTimeInput } from './finance-time'

const WEEKDAYS = Array.from({ length: 7 }, (_, index) =>
  new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2023, 0, index + 1))))
const MONTHS = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2023, index, 1))).replace(/\.$/, ''))

function dateKeyParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (year < 1000 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return { year, month, day }
}

function dateKeyFromIso(value: string | null, timezone: string): string {
  if (!value) return ''
  const localDateTime = toRestaurantDateTimeInput(value, timezone)
  return localDateTime.slice(0, 10)
}

function dateInTimezoneToday(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function dateKeyToText(value: string): string {
  const parts = dateKeyParts(value)
  return parts ? `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}` : ''
}

function maskDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function dateTextToKey(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return null
  const [, day, month, year] = match
  const key = `${year}-${month}-${day}`
  return dateKeyParts(key) ? key : null
}

function moveMonth(value: string, offset: number): string {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function moveYear(value: string, offset: number): string {
  const [year, month] = value.split('-').map(Number)
  return `${year + offset}-${String(month).padStart(2, '0')}`
}

function localDateBoundary(value: string, isEnd: boolean, timezone: string): string | null {
  const wallTime = isEnd ? '23:59' : '00:00'
  const boundary = fromRestaurantDateTimeInput(`${value}T${wallTime}`, timezone)
  if (!boundary) return null
  return isEnd ? new Date(Date.parse(boundary) + 59_999).toISOString() : boundary
}

type CalendarView = 'days' | 'months' | 'years'

function CalendarDays({
  month,
  fromDate,
  toDate,
  today,
  onSelect,
}: {
  month: string
  fromDate: string | null
  toDate: string | null
  today: string
  onSelect: (date: string) => void
}) {
  const [year, monthNumber] = month.split('-').map(Number)
  const leadingDays = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const days: Array<string | null> = Array.from({ length: 42 }, (_, index) => {
    const day = index - leadingDays + 1
    if (day < 1 || day > daysInMonth) return null
    return `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  })

  return <div className="tv-finance-calendar-panel tv-finance-calendar-day-panel" role="group" aria-label="Dias do mês">
    <div className="tv-finance-calendar-weekdays" aria-hidden="true">
      {WEEKDAYS.map((weekday, index) => <span key={`${weekday}-${index}`}>{weekday}</span>)}
    </div>
    <div className="tv-finance-calendar-days">
      {days.map((date, index) => {
        if (!date) return <span key={`empty-${index}`} aria-hidden="true" />
        const selected = date === fromDate || date === toDate
        const inRange = Boolean(fromDate && toDate && date > fromDate && date < toDate)
        const dateLabel = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' })
          .format(new Date(`${date}T12:00:00Z`))
        return <button
          key={date}
          type="button"
          className={`tv-finance-calendar-day${selected ? ' is-selected' : ''}${inRange ? ' is-in-range' : ''}${date === today ? ' is-today' : ''}`}
          aria-label={dateLabel}
          aria-pressed={selected}
          onClick={() => onSelect(date)}
        >{Number(date.slice(-2))}</button>
      })}
    </div>
  </div>
}

function CalendarMonths({
  year,
  selectedMonths,
  visibleMonth,
  onSelect,
}: {
  year: number
  selectedMonths: string[]
  visibleMonth: string
  onSelect: (month: number) => void
}) {
  return <div className="tv-finance-calendar-panel tv-finance-calendar-choice-grid" role="group" aria-label="Escolher mês">
    {MONTHS.map((month, index) => {
      const value = `${year}-${String(index + 1).padStart(2, '0')}`
      const selected = selectedMonths.includes(value)
      return <button
        key={value}
        type="button"
        className={`tv-finance-calendar-choice${selected ? ' is-selected' : ''}${value === visibleMonth ? ' is-current' : ''}`}
        aria-pressed={selected}
        onClick={() => onSelect(index + 1)}
      >{month}</button>
    })}
  </div>
}

function CalendarYears({
  startYear,
  selectedYears,
  visibleYear,
  onSelect,
}: {
  startYear: number
  selectedYears: number[]
  visibleYear: number
  onSelect: (year: number) => void
}) {
  const years = Array.from({ length: 12 }, (_, index) => startYear + index)
  return <div className="tv-finance-calendar-panel tv-finance-calendar-choice-grid" role="group" aria-label="Escolher ano">
    {years.map((year) => {
      const selected = selectedYears.includes(year)
      return <button
        key={year}
        type="button"
        className={`tv-finance-calendar-choice${selected ? ' is-selected' : ''}${year === visibleYear ? ' is-current' : ''}`}
        aria-pressed={selected}
        onClick={() => onSelect(year)}
      >{year}</button>
    })}
  </div>
}

export function FinanceDateRangeFilter({
  initialFrom,
  initialTo,
  referenceDate,
  timezone,
  loading,
  onApply,
  heading = 'Filtrar período',
  description = 'Escolha um intervalo de datas. O fechamento continua considerando o dia inteiro.',
}: {
  initialFrom: string | null
  initialTo: string | null
  referenceDate?: string
  timezone: string
  loading: boolean
  onApply: (from: string | null, to: string | null) => void
  heading?: string
  description?: string
}) {
  const initialFromDate = dateKeyFromIso(initialFrom, timezone)
  const initialToDate = dateKeyFromIso(initialTo, timezone)
  const today = dateKeyFromIso(referenceDate ?? null, timezone) || dateInTimezoneToday(timezone)
  const startingMonth = (initialFromDate || initialToDate || today).slice(0, 7)
  const [fromText, setFromText] = useState(() => dateKeyToText(initialFromDate))
  const [toText, setToText] = useState(() => dateKeyToText(initialToDate))
  const [visibleMonth, setVisibleMonth] = useState(startingMonth)
  const [calendarView, setCalendarView] = useState<CalendarView>('days')
  const [yearPageStart, setYearPageStart] = useState(() => Math.floor(Number(startingMonth.slice(0, 4)) / 12) * 12)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [periodError, setPeriodError] = useState<string | null>(null)
  const fromDate = dateTextToKey(fromText)
  const toDate = dateTextToKey(toText)
  const [visibleYear] = visibleMonth.split('-').map(Number)
  const selectedMonths = [fromDate, toDate].filter((date): date is string => Boolean(date)).map((date) => date.slice(0, 7))
  const selectedYears = [...new Set([fromDate, toDate].filter((date): date is string => Boolean(date)).map((date) => Number(date.slice(0, 4))))]
  const monthTitle = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${visibleMonth}-01T12:00:00Z`))
  const calendarTitle = calendarView === 'days' ? monthTitle
    : calendarView === 'months' ? String(visibleYear)
      : `${yearPageStart} – ${yearPageStart + 11}`
  const titleAriaLabel = calendarView === 'days' ? 'Escolher mês'
    : calendarView === 'months' ? 'Escolher ano'
      : 'Voltar para a escolha de meses'
  const previousLabel = calendarView === 'days' ? 'Mês anterior'
    : calendarView === 'months' ? 'Ano anterior'
      : '12 anos anteriores'
  const nextLabel = calendarView === 'days' ? 'Próximo mês'
    : calendarView === 'months' ? 'Próximo ano'
      : 'Próximos 12 anos'
  const rangeLabel = fromDate && toDate
    ? `${dateKeyToText(fromDate)} – ${dateKeyToText(toDate)}`
    : fromDate ? `A partir de ${dateKeyToText(fromDate)}`
      : toDate ? `Até ${dateKeyToText(toDate)}` : 'Selecionar período'

  function moveCalendar(direction: -1 | 1) {
    if (calendarView === 'days') setVisibleMonth((month) => moveMonth(month, direction))
    else if (calendarView === 'months') setVisibleMonth((month) => moveYear(month, direction))
    else setYearPageStart((year) => year + direction * 12)
  }

  function activateCalendarTitle() {
    if (calendarView === 'days') setCalendarView('months')
    else if (calendarView === 'months') {
      setYearPageStart(Math.floor(visibleYear / 12) * 12)
      setCalendarView('years')
    } else setCalendarView('months')
  }

  function chooseCalendarYear(year: number) {
    setVisibleMonth((month) => moveYear(month, year - visibleYear))
    setYearPageStart(Math.floor(year / 12) * 12)
    setCalendarView('months')
  }

  function chooseCalendarMonth(month: number) {
    setVisibleMonth(`${visibleYear}-${String(month).padStart(2, '0')}`)
    setCalendarView('days')
  }

  function selectDate(date: string) {
    if (!fromDate || toDate) {
      setFromText(dateKeyToText(date))
      setToText('')
      return
    }
    if (date < fromDate) {
      setFromText(dateKeyToText(date))
      setToText(dateKeyToText(fromDate))
    } else {
      setToText(dateKeyToText(date))
    }
    setPopoverOpen(false)
  }

  function applyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedFrom = fromText.trim() ? dateTextToKey(fromText) : null
    const normalizedTo = toText.trim() ? dateTextToKey(toText) : null
    if ((fromText.trim() && !normalizedFrom) || (toText.trim() && !normalizedTo)) {
      setPeriodError('Informe as datas no formato dd/mm/aaaa.')
      return
    }
    if (normalizedFrom && normalizedTo && normalizedFrom > normalizedTo) {
      setPeriodError('A data inicial deve ser anterior ou igual à data final.')
      return
    }
    const from = normalizedFrom ? localDateBoundary(normalizedFrom, false, timezone) : null
    const to = normalizedTo ? localDateBoundary(normalizedTo, true, timezone) : null
    if ((normalizedFrom && !from) || (normalizedTo && !to)) {
      setPeriodError('Não foi possível interpretar esse intervalo no fuso do restaurante.')
      return
    }
    setPeriodError(null)
    onApply(from, to)
  }

  function clearDates() {
    setFromText('')
    setToText('')
    setPeriodError(null)
    setPopoverOpen(false)
  }

  return <form className="tv-finance-period-filter" onSubmit={applyFilter}>
    <div className="tv-finance-period-heading">
      <LuCalendarDays aria-hidden="true" />
      <span><strong>{heading}</strong><small>{description}</small></span>
    </div>
    <div className="tv-finance-period-picker">
      <div className="tv-finance-date-desktop">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger render={<button type="button" className="tv-finance-date-trigger" disabled={loading} />}>
            <LuCalendarDays aria-hidden="true" />
            <span>{rangeLabel}</span>
          </PopoverTrigger>
          <PopoverContent className="tv-finance-date-popover" side="bottom" align="start" role="dialog" aria-label="Selecionar intervalo de datas">
            <div className="tv-finance-calendar-navigation">
              <button type="button" aria-label={previousLabel} onClick={() => moveCalendar(-1)}>
                <LuChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                className="tv-finance-calendar-title"
                aria-label={titleAriaLabel}
                onClick={activateCalendarTitle}
              >{calendarTitle}</button>
              <button type="button" aria-label={nextLabel} onClick={() => moveCalendar(1)}>
                <LuChevronRight aria-hidden="true" />
              </button>
            </div>
            {calendarView === 'days' ? <CalendarDays month={visibleMonth} fromDate={fromDate} toDate={toDate} today={today} onSelect={selectDate} />
              : calendarView === 'months' ? <CalendarMonths
                year={visibleYear}
                selectedMonths={selectedMonths}
                visibleMonth={visibleMonth}
                onSelect={chooseCalendarMonth}
              /> : <CalendarYears
                startYear={yearPageStart}
                selectedYears={selectedYears}
                visibleYear={visibleYear}
                onSelect={chooseCalendarYear}
              />}
            <footer className="tv-finance-calendar-footer">
              <button type="button" className="is-clear" onClick={clearDates}>Limpar datas</button>
              <button type="button" onClick={() => setPopoverOpen(false)}>Fechar</button>
            </footer>
          </PopoverContent>
        </Popover>
      </div>
      <div className="tv-finance-date-mobile">
        <label>De<input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          placeholder="dd/mm/aaaa"
          aria-label="Data inicial"
          value={fromText}
          disabled={loading}
          onChange={(event) => { setFromText(maskDate(event.target.value)); setPeriodError(null) }}
        /></label>
        <label>Até<input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          placeholder="dd/mm/aaaa"
          aria-label="Data final"
          value={toText}
          disabled={loading}
          onChange={(event) => { setToText(maskDate(event.target.value)); setPeriodError(null) }}
        /></label>
      </div>
    </div>
    <button className="tv-finance-period-submit" type="submit" disabled={loading}>
      {loading ? 'Atualizando…' : 'Aplicar período'}
    </button>
    {periodError ? <p className="tv-finance-error tv-finance-period-error" role="alert">{periodError}</p> : null}
  </form>
}
