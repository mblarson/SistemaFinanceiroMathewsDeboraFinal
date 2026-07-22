import { supabaseClient } from '../services/supabase';

export async function updateSalaryRevenue(
  type: 'mathews' | 'debora',
  newValue: number
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Identifica o Mês Ativo no Banco de Dados
    const { data: meses, error: monthError } = await supabaseClient
      .from('meses')
      .select('*')
      .order('ano', { ascending: false });

    if (monthError || !meses || meses.length === 0) {
      return { success: false, message: 'Nenhum mês ativo encontrado no sistema.' };
    }

    // Função para calcular ordenação por mês
    const getMonthValue = (m: any) => {
      const months = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
      return m.ano * 100 + months.indexOf((m.nome || '').toUpperCase().trim());
    };

    const activeMonths = meses.filter((m: any) => m.status === 'ativo');
    activeMonths.sort((a: any, b: any) => getMonthValue(a) - getMonthValue(b));

    const currentMonth = activeMonths.length > 0 ? activeMonths[0] : meses[0];

    // 2. Busca todas as receitas do mês atual
    const { data: receitas, error: recError } = await supabaseClient
      .from('receitas')
      .select('*')
      .eq('mes_id', currentMonth.id);

    if (recError) {
      console.error('Erro ao buscar receitas:', recError);
    }

    // Normalização case-insensitive e remoção de acentos
    const normalize = (str: string) =>
      str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';

    const searchTerm = type === 'mathews' ? 'mathews' : 'debora';
    const defaultDesc = type === 'mathews' ? 'SALÁRIO MATHEWS' : 'SALÁRIO DÉBORA';

    // Encontra a receita equivalente (ex: "Salário Mathews", "salario mathews", "MATHEWS", etc.)
    const matchingRevenue = (receitas || []).find((r: any) =>
      normalize(r.descricao).includes(searchTerm)
    );

    const formattedVal = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(newValue);

    if (matchingRevenue) {
      // 3. Atualiza a receita existente no Supabase / Fallback
      const { error: updateError } = await supabaseClient
        .from('receitas')
        .update({ valor: newValue })
        .eq('id', matchingRevenue.id);

      if (updateError) {
        throw updateError;
      }

      return {
        success: true,
        message: `Receita "${matchingRevenue.descricao}" atualizada para ${formattedVal} no mês de ${currentMonth.nome}/${currentMonth.ano}!`,
      };
    } else {
      // 4. Se não existir no mês atual, insere uma nova receita
      const todayStr = new Date().toISOString().split('T')[0];
      const { error: insertError } = await supabaseClient.from('receitas').insert([
        {
          mes_id: currentMonth.id,
          descricao: defaultDesc,
          valor: newValue,
          data: todayStr,
        },
      ]);

      if (insertError) {
        throw insertError;
      }

      return {
        success: true,
        message: `Nova receita "${defaultDesc}" criada com o valor de ${formattedVal} no mês de ${currentMonth.nome}/${currentMonth.ano}!`,
      };
    }
  } catch (err: any) {
    console.error('Erro ao atualizar salário:', err);
    return {
      success: false,
      message: `Erro ao atualizar salário: ${err.message || err}`,
    };
  }
}
