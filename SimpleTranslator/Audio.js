'use client';

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [audioUri, setAudioUri] = useState(null);
  const [recording, setRecording] = useState(null);
  const socketRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioBlobRef = useRef(null);
  const soundObject = useRef(new Audio.Sound());

  useEffect(() => {
    const setAudioMode = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: true,
        });
      } catch (error) {
        console.error('Error setting audio mode:', error);
        setStatus('Error setting audio mode.');
      }
    };

    setAudioMode();

    // WebSocket setup
    socketRef.current = new WebSocket('ws://localhost:8000/ws/audio');

    socketRef.current.onopen = () => {
      console.log('WebSocket Connected');
    };

    socketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('WebSocket error.');
    };

    socketRef.current.onmessage = (event) => {
      const chunk = event.data;
      audioChunksRef.current.push(chunk);
      audioBlobRef.current = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      const uri = URL.createObjectURL(audioBlobRef.current);
      setAudioUri(uri);
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setStatus('Initializing recording...');

      // Request microphone permission
      const permissionResponse = await Audio.requestPermissionsAsync();
      if (!permissionResponse.granted) {
        setStatus('Permission to access microphone denied');
        return;
      }

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
      setStatus('Recording started...');

      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isDoneRecording) {
          stopRecording();
        }
      });

      await recording.startAsync();

      // Connect WebSocket
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send('start');
      }

    } catch (error) {
      console.error('Recording error:', error);
      setStatus('Error starting recording.');
    }
  };

  const sendAudioChunk = (audioUri) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      // Send recorded audio data to WebSocket
      socketRef.current.send(audioUri);
      setStatus('Sending audio chunk...');
    } else {
      console.warn('WebSocket is not open. Cannot send audio chunk.');
    }
  };

  const stopRecording = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setAudioUri(uri);
        sendAudioChunk(uri);
        setIsRecording(false);
        setStatus('Recording stopped.');
      }
    } catch (error) {
      console.error('Stop recording error:', error);
      setStatus('Error stopping recording.');
    }
  };

  const playAudio = async () => {
    try {
      if (audioUri) {
        await soundObject.current.loadAsync({ uri: audioUri });
        await soundObject.current.playAsync();
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      setStatus('Error playing audio.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Audio Recorder</Text>
      <Text>Status: {status}</Text>

      <View style={styles.buttonContainer}>
        <Button
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
          onPress={isRecording ? stopRecording : startRecording}
          color={isRecording ? 'red' : 'green'}
        />
      </View>

      {audioUri && (
        <View style={styles.audioPlayer}>
          <Button title="Play Processed Audio" onPress={playAudio} color="blue" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  buttonContainer: {
    marginVertical: 20,
  },
  audioPlayer: {
    marginTop: 20,
  },
});

export default AudioRecorder;
