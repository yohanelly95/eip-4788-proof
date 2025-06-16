import { getClient } from '@lodestar/api';
import { config } from '@lodestar/config/default';

export async function createClient() {
    const baseUrl = process.env.BEACON_NODE_URL;
    const client = getClient({ baseUrl, timeoutMs: 60_000 }, { config });

    {
        let r = await client.beacon.getGenesis();
        if (!r.ok) {
            throw r.error;
        }

        client.beacon.genesisTime = r.value().genesisTime;
    }

    {
        let r = await client.config.getSpec();
        if (!r.ok) {
            throw r.error;
        }

        client.beacon.secsPerSlot = r.value().SECONDS_PER_SLOT;
        console.log({ SECONDS_PER_SLOT: r.value().SECONDS_PER_SLOT });
    }

    client.slotToTS = (slot) => {
        return client.beacon.genesisTime + slot * client.beacon.secsPerSlot;
    };

    return client;
}
