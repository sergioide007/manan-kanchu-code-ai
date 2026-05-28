import { Skill, SkillContext, SkillResult, MananKanchuConfig } from '../core/interfaces';

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  constructor(private readonly config?: MananKanchuConfig) {}

  register(skill: Skill): void {
    this.skills.set(skill.id, skill);
  }

  async execute(id: string, context: SkillContext): Promise<SkillResult> {
    const skill = this.skills.get(id);
    if (!skill) return { success: false, errors: [`Skill '${id}' not found`] };

    const enriched: SkillContext = { ...context, config: context.config ?? this.config };

    try {
      return await skill.execute(enriched);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, errors: [message] };
    }
  }

  getAll(): Skill[] {
    return [...this.skills.values()];
  }

  has(id: string): boolean {
    return this.skills.has(id);
  }
}
