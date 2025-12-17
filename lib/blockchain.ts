import {
  BlockfrostProvider,
  MeshWallet,
  MeshTxBuilder
} from '@meshsdk/core';

export interface BlockchainMetadata {
  agent: string;
  usager?: string; // Legacy
  permisOrUsager?: string; // New: contains USR-XXX or Permis
  plaque: string;
  infraction: string; // ID
  infractionName?: string; // New: Clear Text
  montant: number;
  timestamp: string;
}

export async function sendToBlockchain(metadata: BlockchainMetadata): Promise<string> {
  try {
    const NETWORK_ID = 0;
    const BLOCKFROST_API_KEY = "preprod6eb6sa6Y14nBKQqffIGOCkDCRACxRRHd"; //aussi
    console.log(BLOCKFROST_API_KEY);
    // Configuration du fournisseur Blockfrost
    const provider = new BlockfrostProvider(BLOCKFROST_API_KEY, 0);

    // Configuration du wallet avec la phrase mnémonique
    const wallet = new MeshWallet({
      networkId: NETWORK_ID,
      fetcher: provider,
      submitter: provider,
      key: {
        type: 'mnemonic',
        // Nettoie la chaine (enlève les ", [, ]) et découpe par espace ou virgule pour gérer le copier-coller foireux
        words: (process.env.WALLET_MNEMONIC ?? "")
          .replace(/[\[\]"]/g, " ")
          .replace(/,/g, " ")
          .trim()
          .split(/\s+/)
          .filter(w => w.length > 0),
      }
    });

    // Récupération des UTxOs du wallet
    const utxos = await wallet.getUtxos();
    console.log("UTxOs du wallet:", JSON.stringify(utxos, null, 2));

    const changeAddress = await wallet.getChangeAddress();
    console.log("Change Address:", changeAddress);

    // 674 = metadata label (CIP-20)
    const label = 674;

    // Determine User/Permis label and value
    const userLabel = metadata.permisOrUsager?.startsWith('USR') ? 'Usager' : 'Permis';
    const userValue = metadata.permisOrUsager || metadata.usager || 'N/A';

    // Formatage des métadonnées avec description claire
    const txMetadata = {
      msg: [
        `Agent: ${metadata.agent}`,
        `Plaque: ${metadata.plaque}`,
        `${userLabel}: ${userValue}`,
        `Infraction: ${metadata.infractionName || 'Routiere'}`,
        `Reference: ${metadata.infraction}`,
        `Montant: ${metadata.montant} USD`,
        `Timestamp: ${metadata.timestamp}`
      ]
    };

    // Initialisation du constructeur de transaction
    const txBuilder = new MeshTxBuilder({
      fetcher: provider,
      submitter: provider,
      verbose: true,
    });

    // Construction de la transaction avec métadonnées
    const unsignedTx = await txBuilder
      .metadataValue(label, txMetadata)
      .changeAddress(changeAddress)
      .selectUtxosFrom(utxos)
      .complete();

    // Signature et envoi de la transaction
    const signedTx = await wallet.signTx(unsignedTx);
    const txHash = await wallet.submitTx(signedTx);

    console.log("Transaction hash:", txHash);
    return txHash;

  } catch (error) {
    console.error('Erreur lors de l\'envoi sur la blockchain:', error);
    throw new Error('Échec de l\'envoi sur la blockchain: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
  }
}
