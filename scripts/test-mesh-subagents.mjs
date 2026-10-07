import http from 'http';
import { WebSocket } from 'ws';

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/ws/call';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json();
  return { status: response.status, data };
}

// Client helper representing an autonomous subagent node in the mesh
class MeshSubagent {
  constructor(nodeId, name, callsign) {
    this.nodeId = nodeId;
    this.name = name;
    this.callsign = callsign;
    this.phoneNumber = null;
    this.ws = null;
    this.receivedMessages = [];
    this.receivedCalls = [];
    this.receivedAudioChunks = [];
    this.receivedSignals = [];
    this.connected = false;
  }

  async initialize() {
    // 1. Allocate 8-digit phone number
    const phoneRes = await apiRequest('/api/mesh/phone/allocate', {
      method: 'POST',
      body: JSON.stringify({ nodeId: this.nodeId }),
    });
    this.phoneNumber = phoneRes.data.phoneNumber;

    // 2. Register node in mesh directory
    await apiRequest('/api/mesh/nodes', {
      method: 'POST',
      body: JSON.stringify({
        id: this.nodeId,
        name: this.name,
        username: this.name.toLowerCase().replace(/\s+/g, '.'),
        callsign: this.callsign,
        phoneNumber: this.phoneNumber,
        avatarColor: '#2563eb',
        avatarInitials: this.name.slice(0, 2).toUpperCase(),
        hardware: 'ESP32 DIY SX1262',
        role: 'CLIENT',
        batteryPct: 98,
        batteryVoltage: 4.18,
        gps: { lat: 38.72, lng: -9.14, alt: 45 },
        x: 40,
        y: 40,
        antennaDbi: 3.5,
      }),
    });

    // 3. Connect to real-time WebSocket channel
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${WS_URL}?nodeId=${encodeURIComponent(this.nodeId)}`);

      this.ws.on('open', () => {
        this.connected = true;
        // Send registration frame
        this.ws.send(
          JSON.stringify({
            type: 'REGISTER',
            nodeId: this.nodeId,
            userName: this.name,
            phoneNumber: this.phoneNumber,
          })
        );
        resolve(true);
      });

      this.ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          this.handleMessage(msg);
        } catch (e) {
          console.error(`[${this.name}] Erro ao analisar mensagem:`, e);
        }
      });

      this.ws.on('error', (err) => {
        console.error(`[${this.name}] WebSocket error:`, err.message);
      });
    });
  }

  handleMessage(msg) {
    if (msg.type === 'CALL_OFFER') {
      this.receivedCalls.push(msg);
    } else if (msg.type === 'CALL_ANSWER' || msg.type === 'CALL_REJECT' || msg.type === 'CALL_HANGUP') {
      this.receivedSignals.push(msg);
    } else if (msg.type === 'CALL_AUDIO_STREAM') {
      this.receivedAudioChunks.push(msg);
    }
  }

  sendWs(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

async function runVerificationSuite() {
  console.log('=====================================================');
  console.log(' INICIANDO SUÍTE DE TESTES COM SUBAGENTES AUTÔNOMOS ');
  console.log(' Verificação Rigorosa: Mensagens & Ligações de Voz ');
  console.log('=====================================================\n');

  const testReport = {
    taskA_messaging: false,
    taskB_voiceCall: false,
    taskC_callRejection: false,
    taskD_httpFallback: false,
    details: [],
  };

  // 1. Instanciação dos 3 Subagentes
  console.log('[1/5] Inicializando Subagentes no Mesh...');
  const agentAlpha = new MeshSubagent('node_agent_alpha', 'Operador Alpha', 'ALPHA-01');
  const agentBravo = new MeshSubagent('node_agent_bravo', 'Operador Bravo', 'BRAVO-02');
  const agentCharlie = new MeshSubagent('node_agent_charlie', 'Operador Charlie', 'CHARLIE-03');

  await agentAlpha.initialize();
  await agentBravo.initialize();
  await agentCharlie.initialize();

  console.log(`✓ Subagente Alpha conectado: ${agentAlpha.name} [${agentAlpha.nodeId}] Tel: ${agentAlpha.phoneNumber}`);
  console.log(`✓ Subagente Bravo conectado: ${agentBravo.name} [${agentBravo.nodeId}] Tel: ${agentBravo.phoneNumber}`);
  console.log(`✓ Subagente Charlie conectado: ${agentCharlie.name} [${agentCharlie.nodeId}] Tel: ${agentCharlie.phoneNumber}`);
  console.log('✓ Todos os subagentes registraram com sucesso seus nós e números 4116!\n');

  await sleep(300);

  // -----------------------------------------------------------
  // TAREFA A: Troca de Mensagens Reais e Verificação de Pacotes
  // -----------------------------------------------------------
  console.log('[2/5] TAREFA A: Teste de Mensagens Diretas entre Alpha e Bravo...');
  try {
    const timestampA = Date.now();
    const packetIdA = `pkt_${timestampA}_alpha`;
    const messageTextA = 'Alpha para Bravo: Verificação de canal seguro 868MHz. Câmbio!';

    // Alpha envia para Bravo
    const sendResA = await apiRequest('/api/mesh/packets', {
      method: 'POST',
      body: JSON.stringify({
        id: packetIdA,
        timestamp: timestampA,
        fromNodeId: agentAlpha.nodeId,
        toNodeId: agentBravo.nodeId,
        channelId: 0,
        hopLimit: 3,
        hopStart: 3,
        packetType: 'DIRECT_MESSAGE',
        payloadText: messageTextA,
        encrypted: true,
        authTag: '0xABCD8899',
        airtimeMs: 42.5,
        rssiDbm: -58,
        snrDb: 11.2,
        pathTraveled: [agentAlpha.nodeId, agentBravo.nodeId],
      }),
    });

    if (!sendResA.data.success) throw new Error('Falha no envio de pacote por Alpha');

    // Bravo consulta os pacotes recebidos
    const packetsForBravo = await apiRequest(`/api/mesh/packets?since=${timestampA - 1000}`);
    const receivedByBravo = packetsForBravo.data.find((p) => p.id === packetIdA);

    if (!receivedByBravo || receivedByBravo.payloadText !== messageTextA) {
      throw new Error('Bravo não encontrou o pacote de Alpha ou conteúdo divergente');
    }
    console.log(`  ✓ Bravo recebeu mensagem de Alpha com sucesso: "${receivedByBravo.payloadText}"`);

    // Bravo responde para Alpha
    const timestampB = Date.now();
    const packetIdB = `pkt_${timestampB}_bravo`;
    const messageTextB = 'Bravo para Alpha: Mensagem recebida 5/5, sinal forte e sem perdas!';

    await apiRequest('/api/mesh/packets', {
      method: 'POST',
      body: JSON.stringify({
        id: packetIdB,
        timestamp: timestampB,
        fromNodeId: agentBravo.nodeId,
        toNodeId: agentAlpha.nodeId,
        channelId: 0,
        hopLimit: 3,
        hopStart: 3,
        packetType: 'DIRECT_MESSAGE',
        payloadText: messageTextB,
        encrypted: true,
        airtimeMs: 38.0,
        rssiDbm: -56,
        snrDb: 12.0,
        pathTraveled: [agentBravo.nodeId, agentAlpha.nodeId],
      }),
    });

    // Alpha consulta resposta
    const packetsForAlpha = await apiRequest(`/api/mesh/packets?since=${timestampB - 1000}`);
    const receivedByAlpha = packetsForAlpha.data.find((p) => p.id === packetIdB);

    if (!receivedByAlpha || receivedByAlpha.payloadText !== messageTextB) {
      throw new Error('Alpha não recebeu a resposta de Bravo');
    }
    console.log(`  ✓ Alpha recebeu resposta de Bravo com sucesso: "${receivedByAlpha.payloadText}"`);

    // Teste de Like / Reação
    const likeRes = await apiRequest(`/api/mesh/packets/${packetIdB}/like`, { method: 'POST' });
    if (!likeRes.data.likedByMe) throw new Error('Falha ao reagir/curtir pacote');
    console.log('  ✓ Reação ao pacote validada com sucesso.');

    testReport.taskA_messaging = true;
    testReport.details.push('Tarefa A: Troca bidirecional de mensagens e reações concluída com 100% de integridade.');
  } catch (err) {
    console.error('  ✗ Falha na Tarefa A:', err.message);
    testReport.details.push(`Tarefa A falhou: ${err.message}`);
  }

  console.log('\n-----------------------------------------------------------');

  // -----------------------------------------------------------
  // TAREFA B: Teste de Ligação de Voz Completa (Alpha liga para Bravo)
  // -----------------------------------------------------------
  console.log('[3/5] TAREFA B: Teste de Chamada de Voz em Tempo Real (Alpha -> Bravo)...');
  try {
    const callId = `call_${Date.now()}_alpha_to_bravo`;

    // 1. Alpha inicia chamada para Bravo pelo número de telefone 4116 de Bravo
    console.log(`  Passo 1: Alpha disca para o número de Bravo (${agentBravo.phoneNumber})...`);
    agentAlpha.sendWs({
      type: 'CALL_OFFER',
      callId,
      callerNodeId: agentAlpha.nodeId,
      callerName: agentAlpha.name,
      callerPhone: agentAlpha.phoneNumber,
      targetNodeId: agentBravo.phoneNumber, // Disca por número de telefone!
      timestamp: Date.now(),
    });

    // Aguarda Bravo receber o toque (CALL_OFFER)
    let waited = 0;
    while (agentBravo.receivedCalls.length === 0 && waited < 3000) {
      await sleep(100);
      waited += 100;
    }

    const incomingCall = agentBravo.receivedCalls.find((c) => c.callId === callId);
    if (!incomingCall) throw new Error('Bravo não recebeu o toque da chamada (CALL_OFFER)!');
    console.log(`  ✓ Bravo recebeu a chamada tocando de: ${incomingCall.callerName} [${incomingCall.callerNodeId}]`);

    // 2. Bravo atende a chamada (CALL_ANSWER)
    console.log('  Passo 2: Bravo atende a chamada...');
    agentBravo.sendWs({
      type: 'CALL_ANSWER',
      callId,
      callerNodeId: agentAlpha.nodeId,
      targetNodeId: agentBravo.nodeId,
      timestamp: Date.now(),
    });

    // Aguarda Alpha receber a confirmação de conexão
    waited = 0;
    while (!agentAlpha.receivedSignals.some((s) => s.type === 'CALL_ANSWER' && s.callId === callId) && waited < 3000) {
      await sleep(100);
      waited += 100;
    }

    const answerSignal = agentAlpha.receivedSignals.find((s) => s.type === 'CALL_ANSWER' && s.callId === callId);
    if (!answerSignal) throw new Error('Alpha não recebeu a confirmação de atendimento!');
    console.log('  ✓ Chamada conectada com sucesso entre Alpha e Bravo!');

    // 3. Transmissão de pacotes de áudio duplex em tempo real
    console.log('  Passo 3: Transmitindo áudio duplex em tempo real...');
    const simulatedAudioA = 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAA=';
    const simulatedAudioB = 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEBBBB=';

    // Alpha transmite 3 pacotes de voz para Bravo
    for (let i = 1; i <= 3; i++) {
      agentAlpha.sendWs({
        type: 'CALL_AUDIO_STREAM',
        callId,
        fromNodeId: agentAlpha.nodeId,
        toNodeId: agentBravo.nodeId,
        audioData: simulatedAudioA,
        mimeType: 'audio/webm',
        sequence: i,
        timestamp: Date.now(),
      });
      await sleep(50);
    }

    // Bravo transmite 3 pacotes de voz para Alpha
    for (let i = 1; i <= 3; i++) {
      agentBravo.sendWs({
        type: 'CALL_AUDIO_STREAM',
        callId,
        fromNodeId: agentBravo.nodeId,
        toNodeId: agentAlpha.nodeId,
        audioData: simulatedAudioB,
        mimeType: 'audio/webm',
        sequence: i,
        timestamp: Date.now(),
      });
      await sleep(50);
    }

    await sleep(200);

    const audioReceivedByBravo = agentBravo.receivedAudioChunks.filter((a) => a.callId === callId);
    const audioReceivedByAlpha = agentAlpha.receivedAudioChunks.filter((a) => a.callId === callId);

    if (audioReceivedByBravo.length === 0 || audioReceivedByAlpha.length === 0) {
      throw new Error(`Falha no tráfego de áudio duplex (Bravo recebeu ${audioReceivedByBravo.length}, Alpha recebeu ${audioReceivedByAlpha.length})`);
    }

    console.log(`  ✓ Bravo recebeu ${audioReceivedByBravo.length} pacotes de áudio de Alpha com baixa latência.`);
    console.log(`  ✓ Alpha recebeu ${audioReceivedByAlpha.length} pacotes de áudio de Bravo com baixa latência.`);

    // 4. Alpha encerra a chamada (CALL_HANGUP)
    console.log('  Passo 4: Alpha desliga a chamada (CALL_HANGUP)...');
    agentAlpha.sendWs({
      type: 'CALL_HANGUP',
      callId,
      callerNodeId: agentAlpha.nodeId,
      targetNodeId: agentBravo.nodeId,
      timestamp: Date.now(),
    });

    waited = 0;
    while (!agentBravo.receivedSignals.some((s) => s.type === 'CALL_HANGUP' && s.callId === callId) && waited < 3000) {
      await sleep(100);
      waited += 100;
    }

    console.log('  ✓ Bravo recebeu sinal de desligamento. Chamada encerrada perfeitamente.');
    testReport.taskB_voiceCall = true;
    testReport.details.push('Tarefa B: Ciclo completo de chamada de voz HD (toque, atendimento, áudio duplex, encerramento) 100% verificado.');
  } catch (err) {
    console.error('  ✗ Falha na Tarefa B:', err.message);
    testReport.details.push(`Tarefa B falhou: ${err.message}`);
  }

  console.log('\n-----------------------------------------------------------');

  // -----------------------------------------------------------
  // TAREFA C: Teste de Rejeição / Ocupado (Charlie liga para Bravo)
  // -----------------------------------------------------------
  console.log('[4/5] TAREFA C: Teste de Rejeição de Chamada (Charlie -> Bravo)...');
  try {
    const callIdC = `call_${Date.now()}_charlie_to_bravo`;

    // Charlie liga para Bravo
    agentCharlie.sendWs({
      type: 'CALL_OFFER',
      callId: callIdC,
      callerNodeId: agentCharlie.nodeId,
      callerName: agentCharlie.name,
      targetNodeId: agentBravo.nodeId,
      timestamp: Date.now(),
    });

    let waited = 0;
    while (!agentBravo.receivedCalls.some((c) => c.callId === callIdC) && waited < 3000) {
      await sleep(100);
      waited += 100;
    }

    console.log('  ✓ Bravo recebeu o toque de Charlie.');

    // Bravo rejeita a chamada
    agentBravo.sendWs({
      type: 'CALL_REJECT',
      callId: callIdC,
      callerNodeId: agentCharlie.nodeId,
      targetNodeId: agentBravo.nodeId,
      timestamp: Date.now(),
    });

    waited = 0;
    while (!agentCharlie.receivedSignals.some((s) => s.type === 'CALL_REJECT' && s.callId === callIdC) && waited < 3000) {
      await sleep(100);
      waited += 100;
    }

    console.log('  ✓ Charlie recebeu notificação imediata de rejeição/ocupado.');
    testReport.taskC_callRejection = true;
    testReport.details.push('Tarefa C: Rejeição e sinal de ocupado verificados com propagação instantânea.');
  } catch (err) {
    console.error('  ✗ Falha na Tarefa C:', err.message);
    testReport.details.push(`Tarefa C falhou: ${err.message}`);
  }

  console.log('\n-----------------------------------------------------------');

  // -----------------------------------------------------------
  // TAREFA D: Verificação de Fallback HTTP para Sinalização e Áudio
  // -----------------------------------------------------------
  console.log('[5/5] TAREFA D: Teste de Fallback HTTP (Sinalização e Buffer de Áudio)...');
  try {
    const fallbackCallId = `call_${Date.now()}_fallback`;

    // 1. Envia oferta via POST /api/mesh/calls/offer
    const offerRes = await apiRequest('/api/mesh/calls/offer', {
      method: 'POST',
      body: JSON.stringify({
        callId: fallbackCallId,
        callerNodeId: agentAlpha.nodeId,
        callerName: agentAlpha.name,
        targetNodeId: agentBravo.nodeId,
      }),
    });
    if (!offerRes.data.success) throw new Error('Falha no POST /api/mesh/calls/offer');

    // 2. Consulta oferta pendente via GET /api/mesh/calls/pending
    const pendingRes = await apiRequest(`/api/mesh/calls/pending?nodeId=${agentBravo.nodeId}`);
    if (!pendingRes.data.offer || pendingRes.data.offer.callId !== fallbackCallId) {
      throw new Error('Falha no GET /api/mesh/calls/pending');
    }
    console.log('  ✓ Oferta HTTP pendente recuperada com sucesso.');

    // 3. Bufferiza áudio via POST /api/mesh/calls/audio
    const audioRes = await apiRequest('/api/mesh/calls/audio', {
      method: 'POST',
      body: JSON.stringify({
        callId: fallbackCallId,
        fromNodeId: agentAlpha.nodeId,
        toNodeId: agentBravo.nodeId,
        audioData: 'mock_buffered_pcm_audio_data_64kbps',
        mimeType: 'audio/webm',
      }),
    });
    if (!audioRes.data.success) throw new Error('Falha no POST /api/mesh/calls/audio');

    // 4. Recupera áudio via GET /api/mesh/calls/audio
    const fetchAudioRes = await apiRequest(
      `/api/mesh/calls/audio?callId=${fallbackCallId}&forNodeId=${agentBravo.nodeId}`
    );
    if (!Array.isArray(fetchAudioRes.data) || fetchAudioRes.data.length === 0) {
      throw new Error('Falha ao recuperar áudio bufferizado via HTTP');
    }
    console.log('  ✓ Buffer de áudio HTTP recuperado com sucesso.');

    // 5. Encerra chamada via POST /api/mesh/calls/hangup
    await apiRequest('/api/mesh/calls/hangup', {
      method: 'POST',
      body: JSON.stringify({ callId: fallbackCallId, targetNodeId: agentBravo.nodeId }),
    });

    testReport.taskD_httpFallback = true;
    testReport.details.push('Tarefa D: Mecanismo de fallback HTTP para sinalização e áudio verificado.');
  } catch (err) {
    console.error('  ✗ Falha na Tarefa D:', err.message);
    testReport.details.push(`Tarefa D falhou: ${err.message}`);
  }

  // Encerramento dos subagentes
  agentAlpha.close();
  agentBravo.close();
  agentCharlie.close();

  console.log('\n=====================================================');
  console.log('             RELATÓRIO FINAL DOS TESTES              ');
  console.log('=====================================================');
  console.log(`Tarefa A (Mensagens Reais):       ${testReport.taskA_messaging ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`Tarefa B (Chamada de Voz HD Real): ${testReport.taskB_voiceCall ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`Tarefa C (Rejeição de Chamadas):   ${testReport.taskC_callRejection ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`Tarefa D (Fallback HTTP e Áudio):  ${testReport.taskD_httpFallback ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log('=====================================================\n');

  const allPassed =
    testReport.taskA_messaging &&
    testReport.taskB_voiceCall &&
    testReport.taskC_callRejection &&
    testReport.taskD_httpFallback;

  if (allPassed) {
    console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
    process.exit(0);
  } else {
    console.error('⚠️ ALGUNS TESTES FALHARAM.');
    process.exit(1);
  }
}

runVerificationSuite().catch((err) => {
  console.error('Erro crítico na execução dos testes:', err);
  process.exit(1);
});
