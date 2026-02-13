export interface PipelineStatus {
    id: string;
    session_id: string;
    source: string;
    summary_agent_1: string | null;
    summary_agent_2: string | null;
    summary_agent_3: string | null;
    summary_agent_4: string | null;
    updated_at: string;
}
