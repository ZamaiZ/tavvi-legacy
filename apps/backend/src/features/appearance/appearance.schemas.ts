import { platformAppearanceSourceSchema } from '@tavvi/api-contracts'

export const appearanceInputSchema = platformAppearanceSourceSchema

export type AppearanceInput = z.infer<typeof appearanceInputSchema>
