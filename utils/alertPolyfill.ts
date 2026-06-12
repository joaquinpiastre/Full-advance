import { Alert, AlertButton, Platform } from 'react-native';

// En web, react-native-web define Alert.alert como un no-op (no muestra nada
// y no ejecuta los callbacks de los botones). Esto hace que todos los
// Alert.alert con confirmación (Eliminar, Desactivar, etc.) no hagan nada.
// Lo reemplazamos por una implementación basada en window.confirm/alert.
if (Platform.OS === 'web') {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const texto = [title, message].filter(Boolean).join('\n\n');
    const botones = buttons && buttons.length ? buttons : [{ text: 'OK' }];

    if (botones.length === 1) {
      window.alert(texto);
      botones[0].onPress?.();
      return;
    }

    const confirmado = window.confirm(texto);
    const cancelar = botones.find((b) => b.style === 'cancel');
    const confirmar = botones.find((b) => b.style !== 'cancel') ?? botones[botones.length - 1];

    if (confirmado) confirmar?.onPress?.();
    else cancelar?.onPress?.();
  };
}
