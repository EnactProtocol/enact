export interface Author {
    name: string;
    email?: string;
  }
  
  export interface Input {
    type: string;
    description: string;
    default?: string | number | boolean;
  }
  
  export interface Task {
    id: string;
    type?: string;
    language?: string;
    description?: string;
    code?: string;
  }
  
  export interface FlowStep {
    task: string;
  }
  
  export interface Flow {
    steps: FlowStep[];
  }
  
  export interface Output {
    type: string;
    description?: string;
  }
  
  export interface ProtocolDetails {
    enact: string;
    id: string;
    name: string;
    description: string;
    version: string;
    authors: Author[];
    inputs: Record<string, Input>;
    tasks: Task[];
    flow: Flow;
    outputs: Record<string, Output>; 
  }
  
  export interface TaskData {
    id: number;
    name: string;
    description: string;
    isAtomic: boolean;
    protocolDetails: ProtocolDetails;
  }
  