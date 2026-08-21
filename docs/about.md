# About Nomos

## What it is

Nomos is a society simulation that runs in your browser. A few thousand very simple agents live on a grid. They gather two goods, sugar and spice, trade with whoever is nearby, sometimes take things by force, copy the habits of people doing better than them, have children, and die. While that happens, a panel of AI observers watches the same run and writes about what they see, each one in their own way.

Marx reads it as class. Axelrod reads it as cooperation being tested. Flack reads it as the quiet things that hold a society together. Same run, ten different write-ups.

Nothing in the engine creates inequality, classes, markets, money, norms or institutions. Those either show up on their own or they don't, and when they don't, that's an answer too.

## Why it works this way

Most simulations like this do one of two things. Either they code the social behaviour in directly, so a "Power agent" is hardwired to take from others and the result gets called emergence, or they keep the agents so bare that nothing socially interesting ever happens.

Nomos tries to sit between the two, with two decisions.

**Nobody is assigned a type.** Each agent carries four numbers: greed, sociability, dominance and status-seeking, each between 0 and 1. Every rule in the engine reads those numbers. There is no "Power agent" anywhere in the code. There are agents who happen to be high on dominance and low on sociability, who end up going after weaker neighbours, and at the end of each turn a grouping pass looks at everyone's numbers and hands out labels like "Power" to whoever landed near that corner. The four labels are a result, not a setting.

**Ten readings instead of one.** Ten observers are available: Marx, Polanyi, Bourdieu, Granovetter, Schelling, Turchin, Farmer, Epstein, Flack and Axelrod. The app spots notable moments as the run goes and hands each one to whoever has the most to say about it. A burst of fighting might read to Axelrod as exactly the situation cooperation is supposed to survive, to Marx as a conflict sharpening, and to Polanyi as society pushing back. Three paragraphs, one event. Over a full run you hear from everyone, and no single moment gets buried under ten takes at once.

Either half is useful alone. Together they let the same run be read four or five different ways, and let you watch the readings disagree.

## Where this fits

A few people have argued, in different words, that this kind of simulation needs to engage more with actual social theory:

- Farrell and Shalizi, on the gap between how these models are built and what sociologists actually want to ask.
- Roth, on cultural cascades and why fixed-type models struggle with identity.
- Shults, on theory-driven simulation as a programme.

None of them shipped something you can click on. Nomos is one attempt at that.

## What runs tend to look like

Three patterns the engine produces regularly, depending on what you set and which seed you get.

### An equal start drifts into an oligarchy

A town-scale run where everyone gets identical resources, with the default mix. Within a few hundred turns the inequality number climbs past 0.5, then 0.6. A handful of agents get ahead through trade and inheritance. Others copy their habits, but copying costs food, so agents in the middle pay heavily to imitate the top and fall further behind while doing it. By turn 1000 the observers are mostly Turchin, Marx and Bourdieu, taking turns.

### An aggressive start burns through trust

The same town, but weighted toward Power. High-dominance agents take from weaker neighbours early and often. Trade relationships break on every attack, and everyone who saw it remembers who did it. That memory then spreads, because when agents copy their richer neighbours they copy the grudges too. So a rule like "stay away from that one" travels through the population with nobody announcing it. It does bite, but not fast enough: the fighting outpaces the births. The run ends as a collapse, and Axelrod points out the cooperative group never got dense enough to protect itself.

### Give it long enough and money appears

A balanced mix, an equal start, left alone for around a thousand turns. Agents who run short on sugar start paying with IOUs instead. By turn 500 a few of those IOUs are being held by three or more people who have no direct relationship with whoever wrote them. That is the point where a private promise has turned into money, and the biggest issuer is effectively a bank.

Then that agent dies. Everyone holding their IOUs is left with nothing, and those burned holders get nervous about every other IOU they are holding, not just the one that failed. Sometimes that is enough to start a run on the next-largest issuer. Everyone cashes out what they can and the rest is worthless. Polanyi reads it as a made-up commodity coming apart. Farmer reads it as a panic priced by fear.

### Someone becomes the person everyone trades through

In another balanced run, nobody takes over, but one agent ends up with far more trading partners than anyone else. Nobody made them a leader. They have no authority. They are just the point the network settled around. Granovetter reads the position, Flack reads it as something the society is now leaning on, Bourdieu reads the standing that comes with it.

None of these are presets. They are what the engine does when you set it up a certain way.

## Running and saving

You can use Nomos without an account. Every browser gets its own library, and the runs you save show up next time you open the app on the same device. Signing in pulls those saved runs into your account so they follow you between browsers and survive clearing your data.

Every saved run also gets a link. Anyone who opens it replays the same setup and the same seed, so they see exactly what you saw.

## What it doesn't do

- **It isn't a model of any real society.** The starting numbers and rates are first guesses. They produce behaviour that resembles what the theorists wrote about, but nothing here is fitted to historical data. The point is to give the observers something to read.
- **The observers are language models in costume.** They are good at sounding like a specific thinker and bad at saying anything genuinely new.
- **City scale has a ceiling.** The renderer handles 5,000 agents at 60fps. The 50,000-agent version is still on the wish list.
- **There is no public gallery.** Saved runs are yours, or belong to whoever has the link. There is no feed of other people's runs.

## How it got here

The first version was a plain Sugarscape, the model Epstein and Axtell published in 1996: minimal agents, two goods, harvest and trade. Then motivations got added as a fixed list, material, symbolic, normative and power, each with its own branch in the code. It worked, but the engine was now creating the exact things it was supposed to be watching for.

Replacing those fixed types with four continuous numbers, and grouping agents after the fact instead of before, is what made the whole "theories as observers" idea honest. After that came the IOU economy: agents short on sugar can pay with a promise, and sellers can take it or refuse. Nothing about money is configured anywhere. It comes out of that one rule.

The most recent round of work filled three gaps. Norms became something the agents build themselves, through a shared memory of who has attacked whom that spreads by imitation. Leadership became visible, as a trust score computed each turn that fires an event when the network consolidates around one agent. And money became breakable, with issuer reputations the agents learn and a bank run that only needs one failure to start, because burned holders get suspicious of everyone else at the same time. Agents also started copying who their neighbours trade with, not just what their neighbours are like.

Adding Axelrod was deliberate. Without him, every fight in the chronicle read as decline. With him, the same events can read as cooperation being defended rather than falling apart. Same data, opposite reading. That is the point.

## Further reading

- Epstein and Axtell, _Growing Artificial Societies_ (1996). The Sugarscape model Nomos grew out of.
- Axelrod, _The Evolution of Cooperation_ (1984). The tournaments that made tit-for-tat famous.
- Bourdieu, _Distinction_ (1984). How taste and advantage convert into each other.
- Polanyi, _The Great Transformation_ (1944). Treating land, labour and money as ordinary goods, and what happens next.
- Simon, _The Sciences of the Artificial_ (1969). Bounded rationality, and the case for studying complicated systems by building them.
- Farmer, _Making Sense of Chaos_ (2024). The complexity-economics view one of the observers reads through.
- Turchin, _Secular Cycles_ (2009). Long build-ups and long unwindings.
- Flack and Krakauer, on slow variables and collective computation in animal societies.
