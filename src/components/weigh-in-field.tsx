import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { num } from '@/lib/format'
import { Check, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = {
  /** Saved weight for this day, or null if not weighed in. */
  value: number | null
  onSave: (weightKg: number | null) => Promise<void>
}

/**
 * A weigh-in for one day. Saving also updates the profile's current weight, so
 * BMI follows the latest reading — see recordWeighIn.
 */
export function WeighInField({ value, onSave }: Props) {
  const [draft, setDraft] = useState(value == null ? '' : num(value))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDraft(value == null ? '' : num(value))
  }, [value])

  const saved = value == null ? '' : num(value)
  const dirty = draft.trim() !== saved

  async function commit() {
    if (!dirty || busy) return
    const trimmed = draft.trim()
    const parsed = trimmed === '' ? null : Number(trimmed)
    if (parsed !== null && !(parsed > 0 && parsed < 700)) return
    setBusy(true)
    try {
      await onSave(parsed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 space-y-2">
        <Label htmlFor="weigh-in">Weight today (kg)</Label>
        <Input
          id="weigh-in"
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          placeholder="Not weighed in"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void commit()
            }
          }}
        />
      </div>
      <Button
        variant={dirty ? 'default' : 'outline'}
        disabled={!dirty || busy}
        onClick={() => void commit()}
        aria-label="Save weight"
      >
        {busy ? <Loader2 className="animate-spin" /> : <Check />}
        {dirty ? 'Save' : 'Saved'}
      </Button>
    </div>
  )
}
