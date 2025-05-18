export interface QuestionFormData {
  text: string;
  options: string[];
  correctOptionIndex: number;
  category: string;
  difficulty: number;
}

export interface Question extends QuestionFormData {
  id: number;
}

export interface PlayerStats {
  address: string;
  correctAnswers: string;
  totalAnswers: string;
}

// Add this for Flow event types
export interface FlowEvent {
  type: string;
  data: Record<string, any>;
}