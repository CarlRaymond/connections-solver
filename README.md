# Connections Puzzle Vertical Striper

The input to this program comes from the daily Connections puzzle in the New York Times.
There, 16 words appear in a grid, and the goal is to put them into four
groups, where they are all related by some rule. They could be synonyms, parts of a whole,
words that precede or follow another word in a compound or phrase, or have some other
relationship.

Each group, when entered into the puzzle correcly, will have a color associated with
it (yellow, green, blue, or purple). The colors correspond to difficulty: the most
obvious grouping is yellow, and the hardest grouping is purple. A successful solution
will produce four horizontal color stripes. However, that is just a first-order solution.

The goal of this solver is to start with a first-order solution and find, if it exists,
a second-order solution: a solution that will generate vertical stripes in the puzzle.
This is done by entering four words at a time where each word comes from a different color
group. The website will of course consider this an incorrect attempt, and will cost one
"mistake". Since four mistakes are alloted, after entering the fourth group (with one
word of each color), the web site will consider this a loss, and then show the intended
result, with each group in colored horizontal stripes.

However, the "Share your results" button will copy your answer pattern as colored squares
in a 4-by-4 grid. This is where we want to see the vertical stripes.

Entering, at each guess, one word from each of the four groups will produce a pattern with
four colors in each row, but the order will not necessarily be the same from row to row.
You will typically get something that resembles a colorful quilt. But the goal is vertical
stripes.

The theory is that the four items chosen at each guess are ordered alphabetically in each
line in the result panel. And so getting vertical stripes requires entering at each guess
a word from each group in alphabetical order.

This is possible if we can rearrange the words within the groups (within rows) and possibly
the order of the groups (rearranging whole rows), so that they read alphabetically in columns.

This program accepts a .csv file of a first-order solution, with four words on a line that
correspond to a group. It attempts to re-arrange the words in a group, and the order of
whole groups, so that the words are in alphabetical order when read down in columns.

Not all inputs will have a solution, and there may be more than one possible solution.
