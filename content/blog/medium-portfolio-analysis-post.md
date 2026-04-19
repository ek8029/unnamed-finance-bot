# I Analyzed My Portfolio Like a Hedge Fund. Here's What I Found.

*By Evan, founder of [Helm Terminal](https://helmterminal.dev) | April 2026*

*I thought I was diversified. I wasn't even close.*

---

There's a routine most of us follow with our portfolios. You open your brokerage app, see green or red, feel good or bad for about three seconds, and close it. Maybe you check the daily change on your biggest position. Maybe you glance at your total balance and do some quick mental math on how far you are from some imaginary number you picked as "enough."

That's not analysis. That's vibes.

Hedge funds don't operate on vibes. Every morning, portfolio managers run systematic screens across their entire book. They measure concentration risk, factor exposure, correlation, earnings overlap, tax efficiency. Not because they're smarter. Because they have systems that do the looking for them.

I wanted to know what would happen if I ran those same screens on my own portfolio. A normal person's portfolio. ETFs, a handful of individual stocks, some positions I bought because I read a compelling Reddit thread at 11 PM.

I've been building a tool called [Helm Terminal](https://helmterminal.dev) that runs these screens automatically. So I pointed it at my own accounts.

Here's what I found.

## Finding #1: 42% of My Portfolio Was in Three Stocks

I own about 20 positions. That felt diversified. Twenty is a lot of things! Spread across different sectors, different market caps. I felt good about it.

Then I looked at the actual weights.

**42% of my entire portfolio was in just three stocks.** Apple, Microsoft, and NVIDIA. Three positions out of twenty held nearly half my money.

Concentration risk is the percentage of your portfolio's value tied to a small number of positions. [Vanguard's research](https://investor.vanguard.com/investor-resources-education/understanding-investment-risk) suggests keeping any single position below 5-10% of your total portfolio. I had three positions above 12%.

The other 17 positions? They were noise. Some were 1-2% allocations that I'd bought with conviction and then never added to. A few were ETFs that, as I'd later discover, also held heavy positions in those same three stocks.

I had the appearance of diversification. Not the real thing. I thought I was being smart. I was not.

Your brokerage app shows you a list of positions. It does not show you that three of them are doing all the work.

## Finding #2: $2,800 in Tax Losses Just Sitting There

Tax-loss harvesting is the practice of selling losing positions to offset capital gains taxes. It's one of the easiest ways to save money, and I'd been ignoring it for months.

**I had $2,800 in unrealized losses across four positions.** Not massive losses. Small drawdowns in positions I still believed in long-term. But those losses had value. Real money.

The short version: you sell a loser, book the loss, use it to offset gains elsewhere. Or deduct up to $3,000 against ordinary income. Then buy something similar (not identical, because [wash sale rules](https://www.irs.gov/publications/p550#en_US_2023_publink100010601) exist) to maintain your exposure.

That $2,800 in losses, at a 24% marginal tax rate, was worth roughly $672 in tax savings. Just sitting there. Doing nothing. Because I hadn't looked.

The frustrating part is that this isn't complicated. You don't need a CPA to identify unrealized losses. You need a screen that shows you which positions are down and by how much. I just hadn't bothered to run that screen.

## Finding #3: Half My Portfolio Was Reporting Earnings in the Same Week

This one actually scared me.

I knew earnings season was coming. What I didn't know was how exposed I was to a single week of it. When I mapped my holdings against the earnings calendar, **47% of my portfolio by weight was reporting earnings in the same five-day window.**

Think about what that means. In one week, almost half my portfolio's value was subject to the kind of binary event that can move a stock 5-10% in either direction. If two or three of those reports disappointed, I could see a meaningful drawdown in days.

Hedge funds track this obsessively. They call it "event risk clustering." They'll sometimes trim positions ahead of earnings specifically to reduce the portfolio's exposure to a concentrated window of volatility.

I had never once checked this. Most retail investors haven't either. Your brokerage app does not show you an "earnings exposure" screen. It probably should.

This is the kind of analysis that takes 30 seconds with the right tool and 3 hours with a spreadsheet. It's one of the reasons I built [Helm](https://helmterminal.dev). Not because the math is hard, but because nobody does it unless it's automatic.

## Finding #4: My "Tech Diversification" Was a Lie

I thought I had a balanced sector allocation. I owned tech stocks, sure. But I also owned broad market ETFs, some healthcare, a REIT, and a couple of consumer names.

Then I actually calculated the sector breakdown by weight, including what's inside the ETFs.

**68% technology.** Not just my individual tech stocks. The S&P 500 ETF I owned was already 30%+ tech. The "growth" ETF was over 45% tech. When I added it all up, more than two-thirds of my money was riding on one sector.

This is the hidden danger of index fund investing that nobody talks about enough. Buying the S&P 500 feels like diversification. And it is, across 500 companies. But those 500 companies are not equally weighted, and the sector concentration is significant. If you then add individual tech positions on top, you end up with a tech portfolio with a small diversification wrapper.

I wasn't running a diversified portfolio. I was running a tech fund with some decorations.

## Finding #5: $630/Year Lost to Idle Cash

This one stung because it was so obvious.

**I had $14,000 sitting in a checking account earning 0.01% APY.** That's $1.40 per year. A high-yield savings account at the time was paying 4.5%. That's $630 per year on the same cash.

$630 won't change your life. But leaving it on the table for a year because you couldn't be bothered to spend 15 minutes opening a HYSA? That's the kind of thing that stacks up. Over five years, it's $3,150. Over ten, with compounding, it's closer to $8,000. All from a decision that takes less time than ordering lunch.

I'd been meaning to do this for literally a year. Never got around to it.

## Finding #6: The "Best Performer" Illusion

My best-performing stock over the trailing twelve months was up 84%. Incredible return. I felt like a genius for owning it.

It was 1.5% of my portfolio.

That 84% return, applied to a 1.5% position, contributed about 1.3 percentage points to my overall portfolio return. Nice, but not portfolio-defining.

Meanwhile, **my largest position at 18% of the portfolio was down 11%.** That contributed negative 2 percentage points to my total return. One underperforming large position was hurting me nearly twice as much as my best performer was helping me.

This is what institutional investors mean when they talk about "position sizing matters more than stock picking." It doesn't matter how good your picks are if your winners are tiny and your losers are huge.

I'd been patting myself on the back for an 84% winner that barely moved the needle while ignoring an 18% position that was dragging me down. This is the kind of thing you only see when you look at contribution analysis instead of just returns.

## What Hedge Funds Actually Do Differently

The common narrative is that hedge funds have better information, better algorithms, and faster execution. Some do. But the biggest difference is more mundane than that.

**They measure everything.**

They don't just look at returns. They look at risk-adjusted returns. They measure how correlated their positions are to each other. They calculate factor exposure. Is the portfolio secretly just a leveraged bet on growth? On momentum? They run drawdown analysis to understand worst-case scenarios. They monitor concentration continuously.

None of this is proprietary. None of it requires a Bloomberg terminal. The math behind a [Sharpe ratio](https://www.investopedia.com/terms/s/sharperatio.asp) or a concentration index is straightforward. The problem for most retail investors isn't access to formulas. It's that nobody has packaged these screens into something you'd actually use on a Tuesday afternoon.

So we default to the brokerage app. Green or red. Vibes.

## What I Actually Changed

After running this analysis, I made five concrete moves.

**Trimmed the concentration.** I sold about 5% of my three largest positions and redeployed into areas where I was underweight. Still own all three stocks. Just not at "half my portfolio" levels anymore.

**Harvested the tax losses.** Sold the four losing positions, booked the losses, and replaced them with similar (but not identical) ETFs. I'll use those losses to offset gains when I rebalance later this year.

**Moved the idle cash.** Finally opened that high-yield savings account. Took 15 minutes. I should have done it a year ago.

**Set up earnings alerts.** Now I check my earnings exposure at the start of every quarter so I can decide whether to trim ahead of crowded reporting weeks.

**Reframed how I evaluate winners.** I stopped thinking about "what's my best returning stock" and started thinking about "what's contributing the most to my total return." Those are very different questions with very different answers.

## What I Found (Summary)

For anyone skimming, here's the full list:

- **42% concentration** in 3 stocks (target: no single position above 10%)
- **$2,800 in unharvested tax losses** worth $672 in tax savings
- **47% earnings exposure** in a single week
- **68% hidden tech allocation** when including ETF holdings
- **$630/year lost** to idle cash in a 0.01% checking account
- **Best performer (84% return)** contributed less than worst performer (-11%) cost the portfolio

## The Point

You don't need to work at a hedge fund to analyze your portfolio like one. The screens I ran are not complicated. Concentration by weight. Unrealized gain/loss for tax purposes. Sector allocation including ETF holdings. Earnings calendar overlay. Cash position analysis. Contribution analysis by position.

Most of this you can do in a spreadsheet if you're willing to spend an afternoon on it. Some of it you can do with free tools that already exist.

This is why I built [Helm Terminal](https://helmterminal.dev). I wanted these screens running on my portfolio automatically, every day, without the spreadsheet.

If you want to start small, the [free stock analysis tool](https://helmterminal.dev/analyze) lets you run an AI-powered screen on any US stock. No signup, no paywall. Just type in a ticker and see the breakdown.

If you want the full picture (concentration risk, tax-loss harvesting, earnings exposure, sector analysis across all your accounts), [sign up free](https://helmterminal.dev/signup) and connect your brokerage. It takes about 90 seconds.

But honestly, the tool matters less than the habit. The single most valuable thing I did wasn't running a screen. It was deciding to actually look at my portfolio as a system instead of a list of tickers.

Most people never take that step. If you do, you'll probably find what I found. You're not as diversified as you think. You're leaving money on the table. And the fixes are simpler than you'd expect.

The hard part isn't the analysis. The hard part is being honest about what it tells you.
