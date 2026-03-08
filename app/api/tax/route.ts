import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentYear = new Date().getFullYear();

    // Fetch tax estimates, capital gains, and optimization tasks in parallel
    const [
      taxEstimateResult,
      capitalGainsResult,
      optimizationTasksResult,
    ] = await Promise.all([
      supabase
        .from('tax_estimates')
        .select('*')
        .eq('user_id', user.id)
        .eq('tax_year', currentYear)
        .single(),
      supabase
        .from('capital_gains')
        .select('*')
        .eq('user_id', user.id)
        .eq('tax_year', currentYear)
        .order('transaction_date', { ascending: false }),
      supabase
        .from('tax_optimization_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('tax_year', currentYear)
        .eq('is_completed', false)
        .order('priority', { ascending: true }),
    ]);

    const taxEstimate = taxEstimateResult.data || {
      tax_year: currentYear,
      estimated_income_tax: 0,
      short_term_capital_gains: 0,
      long_term_capital_gains: 0,
      deductions_identified: 0,
      total_estimated_tax: 0,
      estimated_quarterly_payment: 0,
    };

    const capitalGains = capitalGainsResult.data || [];
    const optimizationTasks = optimizationTasksResult.data || [];

    // Calculate summary metrics
    const totalRealizedGains = capitalGains
      .filter(g => g.transaction_type === 'sell')
      .reduce((sum, g) => sum + Number(g.gain_loss || 0), 0);

    const shortTermGains = capitalGains
      .filter(g => g.gain_loss_type === 'short_term')
      .reduce((sum, g) => sum + Number(g.gain_loss || 0), 0);

    const longTermGains = capitalGains
      .filter(g => g.gain_loss_type === 'long_term')
      .reduce((sum, g) => sum + Number(g.gain_loss || 0), 0);

    return NextResponse.json({
      taxEstimate: {
        year: taxEstimate.tax_year,
        estimatedIncomeTax: taxEstimate.estimated_income_tax,
        shortTermCapitalGains: taxEstimate.short_term_capital_gains,
        longTermCapitalGains: taxEstimate.long_term_capital_gains,
        deductionsIdentified: taxEstimate.deductions_identified,
        totalEstimatedTax: taxEstimate.total_estimated_tax,
        estimatedQuarterlyPayment: taxEstimate.estimated_quarterly_payment,
      },
      capitalGainsSummary: {
        totalRealizedGains,
        shortTermGains,
        longTermGains,
        transactions: capitalGains.length,
      },
      optimizationTasks: optimizationTasks.map(task => ({
        id: task.id,
        title: task.task_title,
        description: task.task_description,
        potentialSavings: task.potential_savings,
        type: task.task_type,
        priority: task.priority,
        deadline: task.deadline,
      })),
    });
  } catch (error) {
    console.error('Error in tax route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
