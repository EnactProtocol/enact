import { useState, useMemo, useEffect } from "react";
import { SearchBar } from "@/components/SearchBar";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTaskStore } from "@/store/taskStore";
import type { CapabilityWrapper } from "@/types/protocol";
import { Icon } from "@iconify/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { downloadUtils } from "@/lib/download-utils"
const EnactCard = ({ task }: { task: CapabilityWrapper }) => {
  const removeTask = useTaskStore((state) => state.removeTask);

  // Ensure protocolDetails exists before accessing
  if (!task?.protocolDetails) {
    return null; // or return an error state card
  }

  const { 
    enact = "", 
    authors = [], 
    inputs = {}, 
    outputs = {}, 
    tasks = [], 
    flow = { steps: [] } 
  } = task.protocolDetails;

  return (
    <Card className="mb-4 bg-[#ddddde]">
      <Collapsible className="group">
        <CardHeader className="pb-2">
          <div className="flex items-start gap-2">
            <img src="/bubble-bit.webp" alt="Task Icon" className="w-5 h-5 mt-1" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl font-semibold text-gray-900">{task.name}</CardTitle>
                </div>
                <CollapsibleTrigger className="p-1 hover:bg-black/5 rounded-md transition-colors">
                  <Icon icon="lucide:chevron-down" className="w-5 h-5 text-gray-600 transition-transform duration-200 ease-in-out group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
              </div>
              <CardDescription className="mt-1 text-gray-800 -ml-6">{task.description}</CardDescription>
              <div className="flex items-center gap-2 mt-3 -ml-7">
                {enact && (
                  <Badge variant="secondary" className="bg-[#111729] text-gray-200 font-medium border border-gray-200 pointer-events-none">
                    ENACT v{enact}
                  </Badge>
                )}
                {task.isAtomic && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 border border-purple-700 pointer-events-none">
                    atomic
                  </Badge>
                )}
                {authors.map((author) => (
                  <Badge 
                    key={author.name} 
                    variant="secondary" 
                    className="bg-[#BCBCBC] text-gray-700 border border-gray-700 pointer-events-none"
                  >
                    @{author.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CollapsibleContent className="space-y-6">
            <div className="h-px bg-gray-400/30 mt-4" />
            {/* Inputs Section */}
            <div>
            <h3 className="text-gray-900 font-medium mb-2 flex items-center gap-2">
          <Icon icon="mdi:input" className="w-4 h-4 text-black" />
          Inputs <span className="text-black">({Object.keys(task.protocolDetails?.inputs || {}).length})</span>
        </h3>
        <div className="space-y-2">
          {task.protocolDetails?.inputs && Object.entries(task.protocolDetails.inputs).map(([key, input]) => (
                  <div key={key} className="bg-[#BCBCBC] rounded-md p-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-base font-mono text-gray-900">{key}</code>
                          <Badge variant="outline" className="bg-blue-100 text-blue-700 rounded border-blue-700 px-2 py-0.5 pointer-events-none">{input.type}</Badge>
                        </div>
                        <p className="text-sm text-gray-800">{input.description}</p>
                        {input.default && (
                          <p className="text-sm text-gray-500">Default: {input.default}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tasks Section */}
            <div>
              <h3 className="text-gray-900 font-medium mb-2 flex items-center gap-2">
                <Icon icon="lucide:code" className="w-4 h-4 text-black" />
                Tasks
              </h3>
              <div className="space-y-2">
                {task.protocolDetails.tasks.map((t) => (
                  <div key={t.id} className="bg-[#BCBCBC] rounded-md p-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 font-mono">{t.id}</span>
                          {t.type && (
                            <Badge variant="outline" className="bg-purple-100 text-purple-700 rounded border-purple-700 px-2 py-0.5 text-xs font-medium pointer-events-none">{t.type}</Badge>
                          )}
                          {t.language && (
                            <Badge variant="outline" className="bg-green-100 text-green-700 rounded border-green-700 px-2 py-0.5 text-xs font-medium pointer-events-none">{t.language}</Badge>
                          )}
                        </div>
                        {t.description && (
                          <p className="text-sm text-gray-600">{t.description}</p>
                        )}
                        {t.code && (
                          <pre className="mt-2 p-2 bg-gray-200 rounded text-sm text-gray-700 overflow-x-auto font-mono">
                            <code>{t.code}</code>
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Flow Section */}
            <div>
              <h3 className="text-gray-900 font-medium mb-2 flex items-center gap-2">
                <Icon icon="lucide:git-branch" className="w-4 h-4 text-black" />
                Flow
              </h3>
              <div className="space-y-2">
                {task.protocolDetails.flow.steps.map((step, index) => (
                  <div key={index} className="bg-[#BCBCBC] rounded-md p-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#e5e7eb] text-black text-sm">{index + 1}</span>
                      <Icon icon="lucide:arrow-right" className="w-4 h-4 text-black" />
                      <span className="text-black font-mono">{step.task}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Outputs Section */}
            <h3 className="text-gray-900 font-medium mb-2 flex items-center gap-2">
  <Icon icon="mdi:output" className="w-4 h-4 text-black" />
  Outputs <span className="text-black">({Object.keys(task.protocolDetails?.outputs || {}).length})</span>
</h3>
<div className="space-y-2">
  {task.protocolDetails?.outputs && Object.entries(task.protocolDetails.outputs).map(([key, output]) => (
    <div key={key} className="bg-[#BCBCBC] rounded-md p-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <code className="text-base font-mono text-black">{key}</code>
            <Badge variant="outline" className="bg-blue-100 text-blue-700 rounded border-blue-700 px-2 py-0.5 text-xs font-medium pointer-events-none">{output.type}</Badge>
          </div>
          {output.description && (
            <p className="text-sm text-gray-600">{output.description}</p>
          )}
        </div>
      </div>
    </div>
  ))}
</div>
            <div className="h-px bg-gray-400/30 mt-4" />
            <div className="flex items-center gap-2 mt-4">
            <Button
  variant="outline"
  size="sm"
  className="flex-1 flex items-center gap-2 justify-center bg-[#BCBCBC] text-black border border-gray-700 hover:bg-[#CFCFCF] hover:text-black"
  onClick={() => downloadUtils.downloadYAML(task)}
>
  <Icon icon="lucide:download" className="w-4 h-4" />
  Download YAML
</Button>


              <Button
                variant="outline"
                size="sm"
                className="flex-1 flex items-center gap-2 justify-center bg-[#BCBCBC] text-black border border-gray-700 hover:bg-[#CFCFCF] hover:text-black"
                onClick={() => {
                  // Convert task to YAML format
                  const yamlData = {
                    enact: task.protocolDetails.enact,
                    id: task.protocolDetails.id,
                    description: task.protocolDetails.description,
                    version: task.protocolDetails.version,
                    type: task.isAtomic ? "atomic" : "composite",
                    authors: task.protocolDetails.authors,
                    inputs: task.protocolDetails.inputs,
                    tasks: task.protocolDetails.tasks,
                    flow: task.protocolDetails.flow,
                    outputs: task.protocolDetails.outputs
                  };
                  const yaml = JSON.stringify(yamlData, null, 2); // TODO: Convert to actual YAML
                  const blob = new Blob([yaml], { type: 'text/yaml' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${task.protocolDetails.name.toLowerCase().replace(/\s+/g, '-')}.yaml`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                <Icon icon="lucide:download" className="w-4 h-4" />
                Download YAML
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 flex items-center gap-2 justify-center bg-[#BCBCBC] text-black border border-gray-700 hover:bg-[#CFCFCF] hover:text-black"
                onClick={() => {
                  const jsonData = {
                    enact: task.protocolDetails.enact,
                    id: task.protocolDetails.id,
                    description: task.protocolDetails.description,
                    version: task.protocolDetails.version,
                    type: task.isAtomic ? "atomic" : "composite",
                    authors: task.protocolDetails.authors,
                    inputs: task.protocolDetails.inputs,
                    tasks: task.protocolDetails.tasks,
                    flow: task.protocolDetails.flow,
                    outputs: task.protocolDetails.outputs
                  };
                  const json = JSON.stringify(jsonData, null, 2);
                  const blob = new Blob([json], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${task.protocolDetails.name.toLowerCase().replace(/\s+/g, '-')}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                <Icon icon="lucide:share" className="w-4 h-4" />
                Export (JSON currently)
              </Button>
              {task.id > 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 text-red-700 bg-red-100 hover:text-red-700 hover:bg-red-200 border-red-700"
                  onClick={() => removeTask(task.id)}
                >
                  <Icon icon="lucide:trash-2" className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
};

const Index = () => {
  const navigate = useNavigate();
  const tasks = useTaskStore((state) => state.tasks);
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    const loadTasks = async () => {
      await useTaskStore.getState().fetchTasks();
    };
    loadTasks();
  }, []);
  const filteredTasks = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    console.log('tasks', tasks);
    if(!tasks) return [];
    const filtered = !query
      ? tasks
      : tasks.filter((task) => {
          // Safely access properties with optional chaining
          const nameMatch = task?.name?.toLowerCase()?.includes(query) ?? false;
          const idMatch = task?.protocolDetails?.id?.toLowerCase()?.includes(query) ?? false;
          const descriptionMatch = task?.description?.toLowerCase()?.includes(query) ?? false;
          return nameMatch || idMatch || descriptionMatch;
        });
    console.log('filtered', filtered);
    // Deduplicate based on id
    return filtered.filter((task, index, self) =>
      index === self.findIndex((t) => t?.id === task?.id)
    );
  }, [tasks, searchQuery]);
  const isLoading = useTaskStore((state) => state.isLoading);
  const error = useTaskStore((state) => state.error);
  
  if (isLoading) {
    return <div>Loading tasks...</div>;
  }
  
  if (error) {
    return <div>Error: {error}</div>;
  }
  return (
    <div className="min-h-screen bg-[#111828] scrollbar-gutter-stable">
      <div className="container mx-auto py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <img src="/globe-bit.png" alt="Enact Globe" className="h-10 w-auto rotate-180" />
              <h1 className="text-4xl font-bold text-[#dddddd]">Enact Registry</h1>
            </div>
            <Button 
              onClick={() => navigate("/add-task")}
              className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-1.5 rounded-md backdrop-blur-sm border border-white/20 shadow-lg transition-all"
            >
              <Icon icon="lucide:plus" className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </div>

          <div className="mb-6">
            <SearchBar 
              placeholder="Search by name, ID, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#dddddd] border-gray-700 text-black placeholder-gray-400 focus:border-enact-accent focus:ring-0"
            />
          </div>

          <div className="space-y-4">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No tasks found matching "{searchQuery}"
              </div>
            ) : (
              filteredTasks.map((task) => (
                <EnactCard key={task.id} task={task} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
