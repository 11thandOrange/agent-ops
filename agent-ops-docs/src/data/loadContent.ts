// Side-effect import point: each content module registers its own pages
// into the shared pages.ts registry. Imported once from main.tsx before
// the app renders. One import line per content task — content modules
// never import each other.
import { registerPages } from './pages';
import { overviewPages } from './pages/overview';
import { architecturePages } from './pages/architecture';
import { devPipelinePages } from './pages/devPipeline';
import { personalPipelinePages } from './pages/personalPipeline';
import { sourcingDiscoveryPages } from './pages/sourcingDiscovery';
import { integrationsPages } from './pages/integrations';
import { apiKeysPages } from './pages/apiKeys';
import { deploymentPages } from './pages/deployment';
import { runningPipelinesPages } from './pages/runningPipelines';
import { automationsPages } from './pages/automations';
import { commandReferencePages } from './pages/commandReference';

registerPages(overviewPages);
registerPages(architecturePages);
registerPages(devPipelinePages);
registerPages(personalPipelinePages);
registerPages(sourcingDiscoveryPages);
registerPages(integrationsPages);
registerPages(apiKeysPages);
registerPages(deploymentPages);
registerPages(runningPipelinesPages);
registerPages(automationsPages);
registerPages(commandReferencePages);
