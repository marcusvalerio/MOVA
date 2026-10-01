/**
 * Datas atípicas dentro dos períodos dos relatórios.
 * FONTE EXTERNA / NÃO PRESENTE NOS DOCUMENTOS — calendário oficial (feriados nacionais e estaduais do RJ).
 * O efeito é visível nos próprios dados (ex.: 04/03/2019, 07h, Américas 2000 lateral: 394 veíc/h contra ~1.100 em segundas normais).
 */
export const ATYPICAL_DATES: Record<string, string> = {
  "2019-03-04": "Segunda-feira de Carnaval",
  "2019-03-05": "Terça-feira de Carnaval (feriado estadual RJ)",
  "2019-03-06": "Quarta-feira de Cinzas (ponto facultativo até 14h)",
  "2019-05-01": "Dia do Trabalho (feriado nacional)",
  "2022-03-01": "Terça-feira de Carnaval (feriado estadual RJ)",
  "2022-03-02": "Quarta-feira de Cinzas (ponto facultativo até 14h)",
  "2022-05-01": "Dia do Trabalho (feriado nacional, domingo)",
};
