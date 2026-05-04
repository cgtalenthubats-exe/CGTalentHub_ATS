import { getRawPlacementData } from "./src/app/actions/placement-actions";

async function listBUs() {
    try {
        const { placements, jrs } = await getRawPlacementData();
        const s = new Set<string>();
        placements.forEach(r => r.bu && s.add(r.bu));
        jrs.forEach(r => r.bu && s.add(r.bu));
        console.log("--- BU LIST ---");
        console.log(JSON.stringify(Array.from(s).sort(), null, 2));
        console.log("--- END ---");
    } catch (e) {
        console.error(e);
    }
}

listBUs();
