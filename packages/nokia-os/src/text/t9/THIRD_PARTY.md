# Third-party data: the T9 English dictionary

`generated/english.ts` is derived from an openly licensed word-frequency list by
`scripts/build-t9-dictionary.ts` (plan 18b D2, D3). It contains no data from any phone firmware.

## Source

| Item       | Value                                                                 |
| ---------- | --------------------------------------------------------------------- |
| Repository | https://github.com/IlyaSemenov/wikipedia-word-frequency               |
| File       | `results/enwiki-2023-04-13.txt` (word, space, count; 2,765,377 lines) |
| Commit     | `798ea9062d6e5aed1fa87deeeda1cd99d5b37903` (2023-04-17)               |
| SHA-256    | `e2071140a49a6c40c732bd68c36836ef13c0978233fb3d5e1b2a3c2d34faef59`    |
| Licence    | MIT, © 2015 Ilya Semenov (below)                                      |
| Provenance | word counts over English Wikipedia article text (April 2023 dump)     |

The counts are statistics computed over Wikipedia text, not Wikipedia text itself.

## Filter and format

The build keeps a line when its word is lower-case a-z with at most one apostrophe, not first or
last, is 1-32 characters long, and is not a single letter other than `a` and `i`. It takes the
first 30,000 kept words in file order (descending count) and writes them one per line; a line
`#<w>` sets the weight of the words after it, `w = floor(4 * log2(count))`, written only when it
changes. The engine ranks words with `2^(w/4)`.

Rebuild (no diff when the inputs are unchanged):

```sh
mise exec -- vp run @hellotimber/nokia-os#build-t9-dictionary \
  https://raw.githubusercontent.com/IlyaSemenov/wikipedia-word-frequency/798ea9062d6e5aed1fa87deeeda1cd99d5b37903/results/enwiki-2023-04-13.txt
```

## Licence

```
MIT License

Copyright (c) 2015 Ilya Semenov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
