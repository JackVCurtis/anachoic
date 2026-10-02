import { expect, test } from 'vitest'
import {
  ARTIFACT_URL_MAX,
  OUTPUT_FORMATS,
  OUTPUT_FORMAT_WORDS,
} from '../../../shared/output_format'
import * as view from '../../components/helpers/output_format'
import { outputFormat } from '../../components/helpers/strings'

test("the view's output formats and their words are the server's", () => {
  expect(view.OUTPUT_FORMATS).toEqual(OUTPUT_FORMATS)
  expect(view.ARTIFACT_URL_MAX).toBe(ARTIFACT_URL_MAX)
  for (const format of OUTPUT_FORMATS) {
    expect({
      shown: outputFormat.shown[format],
      field: outputFormat.field[format],
      needed: outputFormat.needed[format],
    }).toEqual(OUTPUT_FORMAT_WORDS[format])
  }
})
