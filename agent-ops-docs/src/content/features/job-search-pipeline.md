---
title: Job Search Pipeline
order: 3
summary: Private in-process pipeline that sources postings, drafts a tailored resume and cover letter as PDFs, and prefills application forms — never submits.
status: stable
implements:
  workflows: []
  skills: [resume-job-applier]
  dependencies: ["@heyitschloe/pipeline-orchestrator", "pdfkit", "unpdf", "playwright"]
  integrations: [model-providers, serpapi, jsearch]
runWith:
  - "Triggered by the chat tool run_personal_project_pipeline or an HTTP request of kind personal; runs in-process inside the orchestrator, with no CI runner to dispatch to."
tradeoffs:
  - "Requests are fully synchronous — scrapeAll/scrapeAny process up to max_results candidates sequentially, each costing a full model call plus PDF render, so a full run can be slow."
notes:
  - kind: important
    body: "The orchestrator pipeline never submits an application and never fills a form on its own — it ends with a reviewable package a human submits themselves."
  - kind: note
    body: "the-store, applicant background, and each search provider are all feature-gated by env presence, so the pipeline degrades gracefully when they are unset rather than failing the run."
---

## What it does
The `job-search-pipeline` handler (registry deployment `resume-job-applier`) is this deployment's own private, personal pipeline for building and queuing job applications. Given a posting — pasted, scraped, API-fetched, or discovered by open-web search — it drafts a resume and cover letter tailored to that posting, renders each to a PDF, and produces a machine-readable `formFields` map plus a human-readable application summary. It deliberately stops there: the orchestrator never submits an application or fills a form on its own initiative. A local companion script (skill `job-application-form-prefill`) and a separate Chrome extension can prefill forms when the human opens a link, but those are fill-only, permanently, with no submit path.

## How it works
Unlike the dev pipeline, this one has no repo or CI runner to dispatch to, so it runs entirely in-process (`execution.kind: in-process`), and the orchestrator itself loads the skill and calls the model gateway. `orchestrator/src/handlers/job_search_pipeline.ts` wraps `dispatchPersonalPipeline` in `orchestrator/src/jobs/run_personal_pipeline.ts` behind the generic `@heyitschloe/pipeline-orchestrator` engine's `PipelineHandler` interface, so it registers just like the shipped dev handler. Discovery is chosen by `strategy`: `scrapeOne` treats the request as the single posting; `scrapeAll` crawls a site's listings; `scrapeAny` searches the open web with no site allowlist, retrying with growing batches until `max_results` successes are collected or an attempt cap (`max_results * 3`) is hit. Postings are fetched per `sourcing_method` (`scraping` via Playwright adapters, `api` via JSearch, or `manual` passthrough — which is only valid with `scrapeOne`). Each candidate is drafted by one model call; resume and cover-letter text are rendered to PDF (`pdfkit`, with `unpdf` used to parse an applicant's uploaded-PDF resume), and successful applications are appended as a full row to the-store CSV. `scrapeAll`/`scrapeAny` candidates are deduped against the-store first, and one bad candidate fails independently rather than aborting the batch.

## Configuration & running
The registry entry in `orchestrator/src/registry/pipelines.yaml` sets the defaults: `model_profile: planning`, `resume_source` and `cover_letter_source` both `generated_pdf`, `sourcing_method: scraping`, `strategy: scrapeOne`, `max_results: 10`, and `search_provider: serpapi`. Any of these can be overridden per call. Invoke it with the `run_personal_project_pipeline` chat tool or an HTTP request of kind `personal`. Search providers and integrations are configured by env vars forwarded through `deploy-orchestrator.yml`: `SERPAPI_API_KEY` (SerpAPI, the default for `scrapeAny`), `JSEARCH_API_KEY`/`JSEARCH_BASE_URL` (OpenWebNinja JSearch, shared by `sourcing_method: api` and the jsearch discovery provider), and `ANTHROPIC_API_KEY` (the `claude_web_search` provider). Applicant background (`APPLICANT_*`), the-store target (`THE_STORE_*`), site sessions (`SITE_SESSIONS_DIR`), and the extension key (`EXTENSION_API_KEY`) are all optional and gated by presence. Drafting uses the `planning` model alias via the LiteLLM gateway.
