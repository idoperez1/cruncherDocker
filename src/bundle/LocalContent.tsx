import { MockController } from '~adapters/local/controller';
import MainContent from '~core/MainContent';

export const LocalContent = ({query}: {query: string}) => {
    return (
        <main style={{width: "100%", height: 700, display: "flex", overflow: "hidden"}}>
            <MainContent controller={MockController}
                initialQuery={query}
            />
        </main>
    );
}
