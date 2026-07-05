# The Tragical Calculation Of Two Numbers

A working calculator — addition, subtraction, multiplication, division —
written entirely in the **Shakespeare Programming Language (SPL)**, a real
esolang (2001, Kalle Hasselstrom & Jon Aslund) whose programs are written as
Shakespearean dialogue. Three characters, Romeo, Juliet, and Hamlet, hold the
two numbers and the chosen operator; they interrogate each other, branch to
the right scene, and speak the answer.

`calculator.spl` is genuine SPL: real Dramatis Personae, Acts and Scenes,
`[Enter]`/`[Exeunt]` stage directions, "as good as" comparisons, "If so, let
us proceed to..." conditionals/gotos, and `sum`/`difference`/`product`/
`quotient` arithmetic — all straight from the original 2001 specification.

**One honest caveat:** this interpreter (both the Python one used to build
and test the program, and the JS one that runs it in your browser) uses a
small, explicitly-documented vocabulary of nouns and adjectives (`flower`,
`rose`, `pig`, `happy`, `beautiful`, ... — see the top of `spl_interp.js` /
`generator/spl_core.py`) rather than the full ~100-word list from the
official compiler. The grammar itself (how constants, arithmetic, gotos,
comparisons, and I/O work) matches the real spec exactly, and the program was
fuzz-tested against a plain reference calculator (300+ random add/subtract/
multiply/divide cases, including negative numbers and division-by-zero)
before being finalized — but it won't necessarily compile unmodified on the
original C-based `spl` compiler, since that expects its own specific word
list.

## How to play with it right now

Open `index.html` in a browser. It'll ask for a number, then an operator code
(1 = +, 2 = −, 3 = ×, 4 = ÷), then a second number, and print the answer.
Dividing by zero prints `-1` rather than crashing.

## Hosting it on GitHub Pages

1. Create a new public GitHub repository, e.g. `spl-calculator`.
2. Add these two files to the repo root:
   - `index.html`
   - `calculator.spl`
   - `spl_interp.js`
3. Commit and push:
   ```bash
   git init
   git add index.html calculator.spl spl_interp.js
   git commit -m "A calculator written in Shakespeare Programming Language"
   git branch -M main
   git remote add origin https://github.com/<your-username>/spl-calculator.git
   git push -u origin main
   ```
4. On GitHub: **Settings → Pages** → Source: `Deploy from a branch`, branch
   `main`, folder `/ (root)` → **Save**.
5. After about a minute it's live at:
   ```
   https://<your-username>.github.io/spl-calculator/
   ```

Everything runs client-side — GitHub Pages just serves static files, and your
browser's JS does the SPL interpreting.

## Regenerating / extending

`generator/` contains the Python version of the same interpreter
(`spl_core.py`, `file_parser.py`) used to design and fuzz-test
`calculator.spl` before porting the logic to `spl_interp.js`. If you want to
add more vocabulary or grammar (e.g. `square root`, `twice`, stacks), extend
both files the same way — the JS and Python interpreters are line-for-line
equivalent by design, which is what let me test one against the other.
