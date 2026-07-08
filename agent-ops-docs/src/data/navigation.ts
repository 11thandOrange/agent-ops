// Single-repo flat sections model — agent-ops-docs documents one repo, so
// unlike the OpenHands docs-site reference (which spans several peer repos
// and needs a repo switcher above its tab row), this site has just one tab
// row (Section) and, under each section, a nav tree of pages.

export interface NavItem {
  id: string;
  title: string;
  route: string;
  children?: NavItem[];
  badge?: string;
  isNew?: boolean;
}

export interface Section {
  id: string;
  title: string;
  slug: string; // default route when this section's tab is selected
}

export const sections: Section[] = [
  { id: 'overview', title: 'Overview', slug: '/' },
  { id: 'architecture', title: 'Architecture', slug: '/architecture' },
  { id: 'dev-pipeline', title: 'Dev Pipeline', slug: '/dev-pipeline' },
  { id: 'personal-pipeline', title: 'Personal Pipeline', slug: '/personal-pipeline' },
  { id: 'sourcing-discovery', title: 'Sourcing & Discovery', slug: '/sourcing-discovery' },
  { id: 'integrations', title: 'Integrations', slug: '/integrations' },
  { id: 'api-keys', title: 'API Keys & Env Vars', slug: '/api-keys' },
  { id: 'deployment', title: 'Deployment & CI/CD', slug: '/deployment' },
  { id: 'running-pipelines', title: 'Running Pipelines', slug: '/running-pipelines' },
  { id: 'automations', title: 'Automations', slug: '/automations' },
  { id: 'command-reference', title: 'Command Reference', slug: '/command-reference' },
  { id: 'stretch-features', title: 'Stretch Features', slug: '/stretch-features' },
];

export const navigationBySection: Record<string, NavItem[]> = {
  overview: [{ id: 'overview', title: 'Overview', route: '/' }],

  architecture: [{ id: 'architecture', title: 'Architecture', route: '/architecture' }],

  'dev-pipeline': [{ id: 'dev-pipeline', title: 'Dev Pipeline', route: '/dev-pipeline' }],

  'personal-pipeline': [
    { id: 'pp-overview', title: 'Overview', route: '/personal-pipeline' },
    { id: 'pp-sourcing', title: 'Sourcing Methods', route: '/personal-pipeline/sourcing' },
    { id: 'pp-discovery', title: 'Discovery Strategies', route: '/personal-pipeline/discovery' },
    { id: 'pp-store', title: 'The Store & Dedup', route: '/personal-pipeline/the-store' },
    { id: 'pp-extension', title: 'Chrome Extension', route: '/personal-pipeline/extension', isNew: true },
  ],

  'sourcing-discovery': [
    { id: 'sd-overview', title: 'Overview', route: '/sourcing-discovery' },
    { id: 'sd-scraping', title: 'Add a Scraping Adapter', route: '/sourcing-discovery/scraping-adapters' },
    { id: 'sd-api', title: 'Add an API Provider', route: '/sourcing-discovery/api-providers' },
    { id: 'sd-search', title: 'Add a Search Provider', route: '/sourcing-discovery/search-providers' },
  ],

  integrations: [{ id: 'integrations', title: 'Third-Party Integrations', route: '/integrations' }],

  'api-keys': [{ id: 'api-keys', title: 'API Keys & Env Vars', route: '/api-keys' }],

  deployment: [{ id: 'deployment', title: 'Deployment & CI/CD', route: '/deployment' }],

  'running-pipelines': [{ id: 'running-pipelines', title: 'Running Pipelines', route: '/running-pipelines' }],

  automations: [{ id: 'automations', title: 'Automations & Scheduled Triggers', route: '/automations' }],

  'command-reference': [{ id: 'command-reference', title: 'Command Reference', route: '/command-reference' }],

  'stretch-features': [{ id: 'stretch-features', title: 'Stretch Features', route: '/stretch-features' }],
};
