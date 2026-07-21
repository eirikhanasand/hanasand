import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import EvaluationBenchmarkClient from './evaluationBenchmarkClient'

export const dynamic = 'force-dynamic'

export default function TiEvaluationPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Extraction evaluation'
                description='Independent, prediction-hidden review of actors, victims, techniques, and impact.'
            />
            <EvaluationBenchmarkClient />
        </DashboardPage>
    )
}
