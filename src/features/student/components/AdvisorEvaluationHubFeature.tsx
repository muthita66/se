"use client";

import { LearningResultsFeature } from "@/features/student/components/LearningResultsFeature";

interface AdvisorEvaluationHubFeatureProps {
    session: { [key: string]: unknown };
}

export function AdvisorEvaluationHubFeature({ session }: AdvisorEvaluationHubFeatureProps) {
    return (
        <LearningResultsFeature
            session={session}
            initialTab="subject"
        />
    );
}
