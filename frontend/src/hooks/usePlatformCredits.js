import {useState} from 'react';
import {apiService} from '../services/apiService';

/**
 * Pushing the credits a platform is missing.
 *
 * Runs twice by design. The first call adds everything that is certain and
 * brings back the credits it could not tell apart from ones already there; the
 * second carries the user's answers. A question left unanswered adds nothing -
 * the credit stays as it is and is asked about again next time, which is the
 * safe direction: pushing a duplicate puts it on a public profile, and dropping
 * one loses a job from a CV.
 */
export const usePlatformCredits = () => {
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [summary, setSummary] = useState('');
    const [busy, setBusy] = useState(false);

    const sync = async (platform, resolutions = {}) => {
        setBusy(true);
        try {
            const result = await apiService.syncWorkHistory(platform.id, resolutions);
            setSummary(result.message || '');
            setQuestions(result.questions);
            if (result.questions.length > 0) setAnswers({});
            return result;
        } finally {
            setBusy(false);
        }
    };

    return {questions, answers, summary, busy, sync, setAnswers};
};

export default usePlatformCredits;
