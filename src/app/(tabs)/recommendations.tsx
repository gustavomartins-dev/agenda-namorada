import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ExternalLink, Lightbulb, Send, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { PageHeader } from '@/components/PageHeader';
import { loadRecommendations, saveRecommendations } from '@/data/recommendationStorage';
import type { Recommendation } from '@/domain/recommendation';
import { colors, fonts, gradients, MIN_TOUCH_SIZE, radii, shadows, spacing } from '@/theme/tokens';

const TRACKING_URL = 'https://github.com/gustavomartins-dev/agenda-namorada/issues/1';

export default function RecommendationsScreen() {
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<Recommendation[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => { void loadRecommendations().then((saved) => { setItems(saved); setReady(true); }); }, []);

  async function submit() {
    const clean = description.trim();
    if (clean.length < 12) return;
    const next: Recommendation = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      description: clean,
      target: 'agenda-namorada',
      status: 'received',
      createdAt: new Date().toISOString(),
      trackingUrl: TRACKING_URL,
    };
    const updated = [next, ...items];
    setItems(updated);
    setDescription('');
    await saveRecommendations(updated);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <AppScreen contentContainerStyle={styles.content} scrollProps={{ keyboardShouldPersistTaps: 'handled' }}>
      <PageHeader eyebrow="Kuromi lab" title="Suas ideias" subtitle="Conta o que você gostaria de ver nas agendas." />

      <LinearGradient colors={gradients.hero} style={styles.hero}>
        <View style={styles.heroIcon}><Lightbulb size={25} color={colors.softPink} /></View>
        <View style={styles.heroCopy}><Text style={styles.heroTitle}>Da ideia para um PR ✦</Text><Text style={styles.heroText}>A IA organiza o pedido, Gustavo revisa e nenhuma mudança entra sem aprovação.</Text></View>
      </LinearGradient>

      <View style={styles.card}>
        <View style={styles.agendaPill}><Text style={styles.agendaPillText}>💜 Para a Agenda da Nicolly</Text></View>
        <Text style={styles.label}>O que você gostaria?</Text>
        <TextInput value={description} onChangeText={setDescription} multiline maxLength={1200} placeholder="Eu gostaria muito que tivesse…" placeholderTextColor={colors.textSubtle} style={styles.input} accessibilityLabel="Descreva sua recomendação" />
        <Text style={styles.counter}>{description.length}/1200</Text>
        <Pressable disabled={description.trim().length < 12} onPress={() => void submit()} style={({ pressed }) => [styles.submit, description.trim().length < 12 && styles.disabled, pressed && styles.pressed]}><Send size={18} color={colors.inkOnAccent} /><Text style={styles.submitText}>Enviar recomendação</Text></Pressable>
      </View>

      <View style={styles.sectionTitle}><Sparkles size={16} color={colors.hotPink} /><Text style={styles.sectionTitleText}>Acompanhamento</Text></View>
      {ready && items.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Nenhuma ideia enviada ainda</Text><Text style={styles.emptyText}>Quando você enviar, ela fica salva aqui para acompanhar.</Text></View> : null}
      {items.map((item) => <View key={item.id} style={styles.item}><View style={styles.itemTop}><Text style={styles.badge}>Recebida</Text><Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</Text></View><Text style={styles.itemText}>{item.description}</Text><Text style={styles.itemTarget}>Agenda da Nicolly</Text><Pressable onPress={() => void Linking.openURL(item.trackingUrl)} style={styles.link}><ExternalLink size={15} color={colors.lavender} /><Text style={styles.linkText}>Ver iniciativa no GitHub</Text></Pressable></View>)}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content:{padding:spacing.lg,gap:spacing.lg,paddingBottom:spacing.xxxl}, hero:{padding:spacing.lg,borderRadius:radii.xl,flexDirection:'row',gap:spacing.md,alignItems:'center',...shadows.card}, heroIcon:{width:48,height:48,borderRadius:radii.md,backgroundColor:'rgba(255,92,157,.18)',alignItems:'center',justifyContent:'center'},heroCopy:{flex:1},heroTitle:{color:colors.white,fontFamily:fonts.display,fontSize:19},heroText:{color:colors.textMuted,fontFamily:fonts.body,fontSize:13,lineHeight:18,marginTop:3},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radii.xl,padding:spacing.lg,gap:spacing.sm,...shadows.card},label:{color:colors.lavender,fontFamily:fonts.bodyBold,fontSize:13},agendaPill:{minHeight:MIN_TOUCH_SIZE,borderRadius:radii.md,borderWidth:1,borderColor:colors.primary,backgroundColor:colors.surfaceSoft,alignItems:'center',justifyContent:'center'},agendaPillText:{color:colors.softPink,fontFamily:fonts.bodyBold,fontSize:13},input:{minHeight:130,textAlignVertical:'top',color:colors.text,fontFamily:fonts.body,fontSize:15,lineHeight:21,backgroundColor:colors.canvasSoft,borderWidth:1,borderColor:colors.borderBright,borderRadius:radii.md,padding:spacing.md},counter:{color:colors.textSubtle,fontFamily:fonts.body,fontSize:11,textAlign:'right'},submit:{minHeight:MIN_TOUCH_SIZE,borderRadius:radii.md,backgroundColor:colors.primary,flexDirection:'row',gap:spacing.xs,alignItems:'center',justifyContent:'center'},submitText:{color:colors.inkOnAccent,fontFamily:fonts.bodyExtraBold},disabled:{opacity:.38},pressed:{opacity:.78},sectionTitle:{flexDirection:'row',alignItems:'center',gap:spacing.xs},sectionTitleText:{color:colors.text,fontFamily:fonts.displaySemiBold,fontSize:18},empty:{padding:spacing.xl,borderWidth:1,borderColor:colors.border,borderStyle:'dashed',borderRadius:radii.lg,alignItems:'center'},emptyTitle:{color:colors.text,fontFamily:fonts.bodyBold},emptyText:{color:colors.textMuted,fontFamily:fonts.body,textAlign:'center',marginTop:4},item:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radii.lg,padding:spacing.md,gap:spacing.xs},itemTop:{flexDirection:'row',justifyContent:'space-between'},badge:{color:colors.success,fontFamily:fonts.bodyExtraBold,fontSize:11,textTransform:'uppercase'},date:{color:colors.textSubtle,fontFamily:fonts.body,fontSize:11},itemText:{color:colors.text,fontFamily:fonts.bodyMedium,fontSize:14,lineHeight:20},itemTarget:{color:colors.hotPink,fontFamily:fonts.bodyBold,fontSize:11},link:{minHeight:40,flexDirection:'row',alignItems:'center',gap:6,alignSelf:'flex-start'},linkText:{color:colors.lavender,fontFamily:fonts.bodyBold,fontSize:12},
});
