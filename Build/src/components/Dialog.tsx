import { forwardRef } from "react";
import * as ModalPrimitive from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import modalStyles from "./Dialog.module.css";
import { Icon } from "./Icon";

const ModalComponent = ModalPrimitive.Root;
const ModalActivator = ModalPrimitive.Trigger;
const ModalRenderer = ModalPrimitive.Portal;
const ModalDismisser = ModalPrimitive.Close;

const ModalBackdrop = forwardRef<
  React.ElementRef<typeof ModalPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof ModalPrimitive.Overlay>
>((props, forwardedRef) => {
  const { className, ...restProps } = props;
  return (
    <ModalPrimitive.Overlay
      ref={forwardedRef}
      className={[modalStyles.backdrop, className].filter(Boolean).join(" ")}
      {...restProps}
    />
  );
});
ModalBackdrop.displayName = ModalPrimitive.Overlay.displayName;

const ModalContainer = forwardRef<
  React.ElementRef<typeof ModalPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ModalPrimitive.Content>
>((props, forwardedRef) => {
  const { className, children, ...restProps } = props;
  const { t } = useTranslation();
  return (
    <ModalRenderer>
      <ModalBackdrop />
      <ModalPrimitive.Content
        ref={forwardedRef}
        className={[modalStyles.modal, className].filter(Boolean).join(" ")}
        {...restProps}
      >
        {children}
        <ModalPrimitive.Close className={modalStyles.dismissButton}>
          <Icon
            name="close"
            className={modalStyles.dismissIcon}
            size="1rem"
            decorative
          />
          <span className={modalStyles.visuallyHidden}>{t("common.close")}</span>
        </ModalPrimitive.Close>
      </ModalPrimitive.Content>
    </ModalRenderer>
  );
});
ModalContainer.displayName = ModalPrimitive.Content.displayName;

const ModalHeaderSection = (props: React.HTMLAttributes<HTMLDivElement>) => {
  const { className, ...restProps } = props;
  return (
    <div
      className={[modalStyles.headerSection, className].filter(Boolean).join(" ")}
      {...restProps}
    />
  );
};
ModalHeaderSection.displayName = "DialogHeader";

const ModalFooterSection = (props: React.HTMLAttributes<HTMLDivElement>) => {
  const { className, ...restProps } = props;
  return (
    <div
      className={[modalStyles.footerSection, className].filter(Boolean).join(" ")}
      {...restProps}
    />
  );
};
ModalFooterSection.displayName = "DialogFooter";

const ModalHeading = forwardRef<
  React.ElementRef<typeof ModalPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ModalPrimitive.Title>
>((props, forwardedRef) => {
  const { className, ...restProps } = props;
  return (
    <ModalPrimitive.Title
      ref={forwardedRef}
      className={[modalStyles.modalTitle, className].filter(Boolean).join(" ")}
      {...restProps}
    />
  );
});
ModalHeading.displayName = ModalPrimitive.Title.displayName;

const ModalSubtext = forwardRef<
  React.ElementRef<typeof ModalPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ModalPrimitive.Description>
>((props, forwardedRef) => {
  const { className, ...restProps } = props;
  return (
    <ModalPrimitive.Description
      ref={forwardedRef}
      className={[modalStyles.modalDescription, className].filter(Boolean).join(" ")}
      {...restProps}
    />
  );
});
ModalSubtext.displayName = ModalPrimitive.Description.displayName;

export {
  ModalComponent as Dialog,
  ModalRenderer as DialogPortal,
  ModalBackdrop as DialogOverlay,
  ModalActivator as DialogTrigger,
  ModalDismisser as DialogClose,
  ModalContainer as DialogContent,
  ModalHeaderSection as DialogHeader,
  ModalFooterSection as DialogFooter,
  ModalHeading as DialogTitle,
  ModalSubtext as DialogDescription,
};
