export const initializeVoiceStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
  
    stream.getTracks().forEach(track => 
      peerConnection.addTrack(track, stream)
    );
  
    return {
      peerConnection,
      stream,
      createOffer: async () => {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        return offer;
      }
    };
  };
  