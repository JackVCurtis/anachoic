import { z } from 'zod'

/**
 * The optional session argument every model tool takes. Only a client the
 * server cannot identify needs it: join_board mints an id, and the model
 * passes it back on every later call.
 */
export const sessionInput = {
  session: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe(
      'Only when join_board gave you a session id to pass: that id. Leave it out otherwise.'
    ),
}
