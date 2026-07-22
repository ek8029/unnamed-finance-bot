-- 057_evidence_source_class.sql
-- Thesis v2 §5: the judge records what KIND of confirmation each piece of
-- evidence is, so the corroboration ladder can count independent classes
-- instead of counting URLs.
--
-- Why this cannot be inferred at read time: source class was being derived from
-- the domain, and Yahoo plus Nasdaq are 741 of 1,000 sampled news rows while
-- syndicating reporting and opinion alike. "France ended Palantir's contract
-- with its intelligence agency" was therefore filed as analyst opinion and
-- discounted. A text heuristic recovers about 80% of it on a blind sample; the
-- judge already has the whole source in front of it and gets it right.
--
-- Nullable on purpose. The 2,208 existing rows keep NULL and fall back to the
-- heuristic, so nothing needs a paid re-judge.

alter table pillar_evidence add column if not exists source_class text
  check (
    source_class is null
    or source_class in ('company_filing', 'primary_news', 'analyst_opinion', 'insider', 'xbrl', 'price')
  );

comment on column pillar_evidence.source_class is
  'What kind of independent confirmation this is. Repetition within one class adds recency, never weight.';
