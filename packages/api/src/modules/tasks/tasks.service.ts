import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { AnthropicProvider } from '../../providers/anthropic.provider';
import { MemoryService } from '../memory/memory.service';
import type { Task, TaskStatus, TaskPriority } from '@ai-biz-os/shared';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly supabase: SupabaseProvider,
    private readonly anthropic: AnthropicProvider,
    private readonly memory: MemoryService,
  ) {}

  async listTasks(businessId: string, status?: TaskStatus): Promise<Task[]> {
    let query = this.supabase.getAdminClient()
      .from('tasks')
      .select('*')
      .eq('business_id', businessId)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as Task[];
  }

  async getTask(businessId: string, taskId: string): Promise<Task> {
    const { data, error } = await this.supabase.getAdminClient()
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('business_id', businessId)
      .single();
    if (error || !data) throw new BadRequestException('Task not found');
    return data as Task;
  }

  async createTask(businessId: string, payload: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    due_date?: string;
    created_by_ai?: boolean;
  }): Promise<Task> {
    const { data, error } = await this.supabase.getAdminClient()
      .from('tasks')
      .insert({
        business_id: businessId,
        title: payload.title,
        description: payload.description ?? null,
        priority: payload.priority ?? 'medium',
        status: 'todo',
        due_date: payload.due_date ?? null,
        created_by_ai: payload.created_by_ai ?? false,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data as Task;
  }

  async updateTask(businessId: string, taskId: string, payload: Partial<{
    title: string;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    due_date: string;
  }>): Promise<Task> {
    const { data, error } = await this.supabase.getAdminClient()
      .from('tasks')
      .update(payload)
      .eq('id', taskId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error || !data) throw new BadRequestException(error?.message ?? 'Task not found');
    return data as Task;
  }

  async deleteTask(businessId: string, taskId: string): Promise<void> {
    const { error } = await this.supabase.getAdminClient()
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('business_id', businessId);

    if (error) throw new BadRequestException(error.message);
  }

  async generateTasks(businessId: string, context: string): Promise<Task[]> {
    const memories = await this.memory.retrieveRelevant(businessId, context, 5);
    const memoriesText = await this.memory.formatMemoriesForPrompt(memories);

    const { data: business } = await this.supabase.getAdminClient()
      .from('businesses')
      .select('name, goals')
      .eq('id', businessId)
      .single();

    const systemPrompt = `You are an AI Chief of Staff for ${business?.name ?? 'this business'}. Business goals: ${(business?.goals ?? []).join(', ')}. Context:\n${memoriesText}\n\nGenerate actionable tasks. Return JSON array: [{"title": "...", "description": "...", "priority": "high|medium|low", "due_date": "YYYY-MM-DD or null"}]`;

    const userMessage = `Based on: ${context}\n\nGenerate 3-5 specific, actionable tasks to move the business forward.`;

    let taskPayloads: Array<{ title: string; description?: string; priority?: TaskPriority; due_date?: string }> = [];

    try {
      const raw = await this.anthropic.complete({
        systemPrompt,
        userMessage,
        businessId,
        feature: 'task_generation',
        maxTokens: 1024,
      });
      taskPayloads = JSON.parse(raw) as typeof taskPayloads;
    } catch (err) {
      this.logger.error('Task generation failed', { err });
      taskPayloads = [{ title: context, priority: 'medium' }];
    }

    const created: Task[] = [];
    for (const tp of taskPayloads) {
      const task = await this.createTask(businessId, { ...tp, created_by_ai: true });
      created.push(task);
    }

    return created;
  }

  async getStats(businessId: string) {
    const today = new Date().toISOString().split('T')[0];
    const [todo, inProgress, done, dueToday] = await Promise.all([
      this.supabase.getAdminClient().from('tasks').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'todo'),
      this.supabase.getAdminClient().from('tasks').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'in_progress'),
      this.supabase.getAdminClient().from('tasks').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'done'),
      this.supabase.getAdminClient().from('tasks').select('*', { count: 'exact', head: true }).eq('business_id', businessId).lte('due_date', `${today}T23:59:59Z`).neq('status', 'done'),
    ]);

    return {
      todo: todo.count ?? 0,
      inProgress: inProgress.count ?? 0,
      done: done.count ?? 0,
      dueToday: dueToday.count ?? 0,
    };
  }
}
