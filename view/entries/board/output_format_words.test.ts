import { expect, test } from 'vitest'
import { OUTPUT_FORMATS, OUTPUT_FORMAT_WORDS } from '../../../shared/output_format'
import * as view from '../../components/helpers/output_format'
import { outputFormat } from '../../components/helpers/strings'

test("the view's output formats and their names are the server's", () => {
  expect(view.OUTPUT_FORMATS).toEqual(OUTPUT_FORMATS)
  for (const format of OUTPUT_FORMATS) {
    expect(outputFormat.shown[format]).toBe(OUTPUT_FORMAT_WORDS[format].shown)
  }
})
